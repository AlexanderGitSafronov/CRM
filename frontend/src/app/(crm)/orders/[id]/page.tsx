'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { formatCurrency, formatDateTime, formatRelative } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import OrderForm from '@/components/orders/OrderForm';
import NovaPoshtaSelect from '@/components/nova-poshta/NovaPoshtaSelect';
import type { Order, OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS, ORDER_SOURCE_LABELS } from '@/types';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import Modal from '@/components/ui/Modal';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  User,
  Package,
  Clock,
  ChevronRight,
  ShieldAlert,
  Truck,
  ExternalLink,
  Loader2,
  Save,
  X,
  FileText,
} from 'lucide-react';

const DELIVERY_SERVICES = [
  { value: 'NOVA_POSHTA', label: 'Нова Пошта' },
  { value: 'UKRPOSHTA', label: 'Укрпошта' },
  { value: 'COURIER', label: 'Кур\'єр' },
  { value: 'PICKUP', label: 'Самовивіз' },
];

const STATUSES: OrderStatus[] = [
  'NEW', 'PROCESSING', 'CONFIRMED', 'CALLED', 'NO_ANSWER', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED',
];

const DELIVERY_SERVICE_LABELS: Record<string, string> = {
  NOVA_POSHTA: 'Нова Пошта',
  UKRPOSHTA: 'Укрпошта',
  COURIER: 'Кур\'єр',
  PICKUP: 'Самовивіз',
};

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'Заказ создан',
  STATUS_CHANGED: 'Статус изменён',
  MANAGER_CHANGED: 'Менеджер изменён',
  UPDATED: 'Обновлён',
  UPSELL_ADDED: 'Доп. продаж',
  CC_ORDER_UPDATED: 'КЦ обновил заказ',
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [ttnModal, setTtnModal] = useState(false);
  const [ttnForm, setTtnForm] = useState({ weight: '0.5', cost: '', codAmount: '', description: 'Товар', seats: '1', payerType: 'Recipient' as 'Recipient' | 'Sender' });
  const [ttnLoading, setTtnLoading] = useState(false);

  // Delivery editing
  const [deliveryEdit, setDeliveryEdit] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    deliveryService: '',
    deliveryCity: '',
    deliveryAddress: '',
    npCityRef: '',
    npWarehouseRef: '',
    recipientName: '',
  });
  const [deliverySaving, setDeliverySaving] = useState(false);

  const fetchOrder = async () => {
    try {
      const res = await api.get(`/orders/${id}`);
      const o: Order = res.data;
      setOrder(o);
      setDeliveryForm({
        deliveryService: o.deliveryService ?? '',
        deliveryCity: o.deliveryCity ?? '',
        deliveryAddress: o.deliveryAddress ?? '',
        npCityRef: o.npCityRef ?? '',
        npWarehouseRef: o.npWarehouseRef ?? '',
        recipientName: o.recipientName ?? '',
      });
    } catch {
      toast.error('Заказ не найден');
      router.replace('/orders');
    }
    setLoading(false);
  };

  const handleSaveDelivery = async () => {
    setDeliverySaving(true);
    try {
      await api.patch(`/orders/${id}`, {
        deliveryService: deliveryForm.deliveryService || null,
        deliveryCity: deliveryForm.deliveryCity.trim() || null,
        deliveryAddress: deliveryForm.deliveryAddress.trim() || null,
        npCityRef: deliveryForm.npCityRef || null,
        npWarehouseRef: deliveryForm.npWarehouseRef || null,
        recipientName: deliveryForm.recipientName.trim() || null,
      });
      toast.success('Доставку збережено');
      setDeliveryEdit(false);
      fetchOrder();
    } catch {
      toast.error('Помилка збереження');
    }
    setDeliverySaving(false);
  };

  useEffect(() => {
    fetchOrder().then(() => {
      api.put(`/notifications/read-by-entity/${id}`).then(() => {
        window.dispatchEvent(new CustomEvent('notifications:refresh'));
      }).catch(() => {});
    });
  }, [id]);

  const handleStatusChange = async (status: OrderStatus) => {
    if (!order || status === order.status) return;
    setStatusUpdating(true);
    try {
      await api.put(`/orders/${order.id}`, { status });
      toast.success(`Статус: ${ORDER_STATUS_LABELS[status]}`);
      fetchOrder();
    } catch {
      toast.error('Ошибка при изменении статуса');
    }
    setStatusUpdating(false);
  };

  const handleToggleBlacklist = async () => {
    if (!order) return;
    const isBlacklisted = !order.customer.isBlacklisted;
    let blacklistReason: string | null = null;
    if (isBlacklisted) {
      blacklistReason = prompt('Причина (необов\'язково):') ?? '';
    }
    setBlacklistLoading(true);
    try {
      await api.patch(`/customers/${order.customer.id}/blacklist`, { isBlacklisted, blacklistReason });
      toast.success(isBlacklisted ? 'Клієнта додано до чорного списку' : 'Клієнта знято з чорного списку');
      fetchOrder();
    } catch {
      toast.error('Помилка');
    }
    setBlacklistLoading(false);
  };

  const handleCreateTtn = async () => {
    if (!order) return;
    setTtnLoading(true);
    try {
      const res = await api.post('/nova-poshta/create-ttn', {
        orderId: order.id,
        weight: Number(ttnForm.weight),
        cost: Number(ttnForm.cost) || order.total,
        codAmount: Number(ttnForm.codAmount) || 0,
        description: ttnForm.description,
        seats: Number(ttnForm.seats),
        payerType: ttnForm.payerType,
      });
      toast.success(`ТТН створено: ${res.data.ttn}`);
      setTtnModal(false);
      fetchOrder();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Помилка';
      toast.error(msg);
    }
    setTtnLoading(false);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.delete(`/orders/${id}`);
      toast.success('Заказ удалён');
      router.replace('/orders');
    } catch {
      toast.error('Ошибка при удалении');
    }
    setDeleteLoading(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!order) return null;

  const canEdit = user?.role !== 'VIEWER';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Blacklist warning */}
      {order.customer.isBlacklisted && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl p-4">
          <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400">Клієнт у чорному списку</p>
            {order.customer.blacklistReason && (
              <p className="text-sm text-red-600 dark:text-red-500 mt-0.5">{order.customer.blacklistReason}</p>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/orders" className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Заказ #{order.orderNum}
            </h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Создан {formatDateTime(order.createdAt)}
            {order.manager && ` · Менеджер: ${order.manager.name}`}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setEditModal(true)} className="btn-secondary">
              <Edit className="w-4 h-4" />
              Редактировать
            </button>
            {user?.role === 'ADMIN' && (
              <button onClick={() => setDeleteConfirm(true)} className="btn-danger">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Status pipeline */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Статус заказа
            </h2>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => canEdit && handleStatusChange(s)}
                  disabled={statusUpdating || !canEdit}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    order.status === s
                      ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 disabled:cursor-not-allowed'
                  }`}
                >
                  {ORDER_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Items */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-gray-100 dark:border-gray-800">
              <Package className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Товары</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                  <th className="text-left table-header p-3">Товар</th>
                  <th className="text-right table-header p-3">Цена</th>
                  <th className="text-right table-header p-3">Кол-во</th>
                  <th className="text-right table-header p-3">Итого</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-t border-gray-50 dark:border-gray-800/50">
                    <td className="p-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.name}
                      </span>
                    </td>
                    <td className="p-3 text-right text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="p-3 text-right text-sm text-gray-600 dark:text-gray-400">
                      {item.quantity}
                    </td>
                    <td className="p-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(item.price * item.quantity)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
                  <td colSpan={3} className="p-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Итого:
                  </td>
                  <td className="p-3 text-right text-base font-bold text-gray-900 dark:text-white">
                    {formatCurrency(order.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Comment */}
          {order.comment && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Комментарий</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{order.comment}</p>
            </div>
          )}

          {/* History */}
          {order.history && order.history.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">История изменений</h2>
              </div>
              <div className="space-y-2">
                {order.history.map((h) => (
                  <div key={h.id} className="flex items-start gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {ACTION_LABELS[h.action] || h.action}
                      </span>
                      {h.oldValue && h.newValue && (
                        <span className="text-gray-400 ml-1">
                          {h.oldValue} → {h.newValue}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatRelative(h.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Customer */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Клиент</h2>
              </div>
              <Link
                href={`/customers/${order.customer.id}`}
                className="text-xs text-primary-600 hover:underline flex items-center gap-1"
              >
                Профиль <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-gray-900 dark:text-white">{order.customer.name}</p>
                {order.customer.isBlacklisted && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">
                    <ShieldAlert className="w-3 h-3" /> Чорний список
                  </span>
                )}
              </div>
              <a
                href={`tel:${order.customer.phone}`}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                {order.customer.phone}
              </a>
              {order.customer.email && (
                <a
                  href={`mailto:${order.customer.email}`}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {order.customer.email}
                </a>
              )}
              {order.customer.city && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="w-3.5 h-3.5" />
                  {order.customer.city}
                </div>
              )}
              {canEdit && (
                <button
                  onClick={handleToggleBlacklist}
                  disabled={blacklistLoading}
                  className={`mt-1 w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    order.customer.isBlacklisted
                      ? 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-green-400 hover:text-green-600'
                      : 'border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {order.customer.isBlacklisted ? 'Зняти з чорного списку' : 'Додати до чорного списку'}
                </button>
              )}
            </div>
          </div>

          {/* Order info */}
          <div className="card p-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Информация</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Источник</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {ORDER_SOURCE_LABELS[order.source] || order.source}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Менеджер</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {order.manager?.name || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Создан</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatDateTime(order.createdAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Обновлён</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatDateTime(order.updatedAt)}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-2">
                <span className="text-gray-500 font-medium">Сумма заказа</span>
                <span className="font-bold text-gray-900 dark:text-white text-lg">
                  {formatCurrency(order.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery info */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Truck className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Доставка</h2>
              {canEdit && !deliveryEdit && (
                <button
                  onClick={() => setDeliveryEdit(true)}
                  className="ml-auto text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <Edit className="w-3 h-3" /> Редагувати
                </button>
              )}
            </div>

            {deliveryEdit ? (
              <div className="space-y-3">
                {/* Service selector */}
                <div className="grid grid-cols-2 gap-1.5">
                  {DELIVERY_SERVICES.map((ds) => (
                    <button
                      key={ds.value}
                      onClick={() => setDeliveryForm((p) => ({ ...p, deliveryService: p.deliveryService === ds.value ? '' : ds.value, npCityRef: '', npWarehouseRef: '' }))}
                      className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        deliveryForm.deliveryService === ds.value
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {ds.label}
                    </button>
                  ))}
                </div>

                {/* Recipient */}
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={deliveryForm.recipientName}
                    onChange={(e) => setDeliveryForm((p) => ({ ...p, recipientName: e.target.value }))}
                    placeholder="ПІБ одержувача"
                    className="input w-full pl-9 text-sm"
                  />
                </div>

                {/* City + warehouse / address */}
                {deliveryForm.deliveryService === 'NOVA_POSHTA' ? (
                  <NovaPoshtaSelect
                    cityValue={deliveryForm.deliveryCity}
                    addressValue={deliveryForm.deliveryAddress}
                    onCityChange={(v) => setDeliveryForm((p) => ({ ...p, deliveryCity: v }))}
                    onAddressChange={(v) => setDeliveryForm((p) => ({ ...p, deliveryAddress: v }))}
                    onCityRefChange={(v) => setDeliveryForm((p) => ({ ...p, npCityRef: v }))}
                    onWarehouseRefChange={(v) => setDeliveryForm((p) => ({ ...p, npWarehouseRef: v }))}
                  />
                ) : (
                  <>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        value={deliveryForm.deliveryCity}
                        onChange={(e) => setDeliveryForm((p) => ({ ...p, deliveryCity: e.target.value }))}
                        placeholder="Місто"
                        className="input w-full pl-9 text-sm"
                      />
                    </div>
                    <input
                      type="text"
                      value={deliveryForm.deliveryAddress}
                      onChange={(e) => setDeliveryForm((p) => ({ ...p, deliveryAddress: e.target.value }))}
                      placeholder="Відділення / адреса"
                      className="input w-full text-sm"
                    />
                  </>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setDeliveryEdit(false); setDeliveryForm({ deliveryService: order.deliveryService ?? '', deliveryCity: order.deliveryCity ?? '', deliveryAddress: order.deliveryAddress ?? '', npCityRef: order.npCityRef ?? '', npWarehouseRef: order.npWarehouseRef ?? '', recipientName: order.recipientName ?? '' }); }}
                    className="btn-secondary flex-1 justify-center text-xs py-1.5"
                  >
                    <X className="w-3.5 h-3.5" /> Скасувати
                  </button>
                  <button
                    onClick={handleSaveDelivery}
                    disabled={deliverySaving}
                    className="btn-primary flex-1 justify-center text-xs py-1.5"
                  >
                    {deliverySaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Зберегти
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-sm">
                {order.deliveryService ? (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Спосіб</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {DELIVERY_SERVICE_LABELS[order.deliveryService] || order.deliveryService}
                    </span>
                  </div>
                ) : null}
                {order.recipientName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Одержувач</span>
                    <span className="font-medium text-gray-900 dark:text-white">{order.recipientName}</span>
                  </div>
                )}
                {order.deliveryCity && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Місто</span>
                    <span className="font-medium text-gray-900 dark:text-white">{order.deliveryCity}</span>
                  </div>
                )}
                {order.deliveryAddress && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-500">Адреса</span>
                    <span className="font-medium text-gray-900 dark:text-white">{order.deliveryAddress}</span>
                  </div>
                )}
                {!order.deliveryService && !order.deliveryCity && !order.deliveryAddress && !order.recipientName && (
                  <p className="text-xs text-gray-400 italic">Не заповнено</p>
                )}
                {/* TTN */}
                {order.trackingNumber ? (
                  <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">ТТН</span>
                      <a
                        href={`https://novaposhta.ua/tracking/?cargo_number=${order.trackingNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 font-mono text-sm font-semibold text-primary-600 hover:underline"
                      >
                        {order.trackingNumber}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const res = await api.get('/nova-poshta/print-ttn', { params: { orderId: order.id, format: 'pdf', size: '100x100' } });
                              window.open(res.data.url, '_blank');
                            } catch (err: unknown) {
                              const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Помилка';
                              toast.error(msg);
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Маркування PDF
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const res = await api.get('/nova-poshta/print-ttn', { params: { orderId: order.id, format: 'pdf', size: 'A4' } });
                              window.open(res.data.url, '_blank');
                            } catch (err: unknown) {
                              const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Помилка';
                              toast.error(msg);
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Накладна A4
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  order.deliveryService === 'NOVA_POSHTA' && canEdit && (
                    <button
                      onClick={() => {
                        setTtnForm((p) => ({ ...p, cost: String(order.total), codAmount: String(order.total) }));
                        setTtnModal(true);
                      }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-primary-300 dark:border-primary-800 text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      Створити ТТН
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TTN Modal */}
      <Modal open={ttnModal} onClose={() => setTtnModal(false)} title="Створити ТТН в Новій Пошті" size="sm">
        <div className="space-y-4">
          {!order.npCityRef || !order.npWarehouseRef ? (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-400">
              Місто та відділення НП не вибрані. Перейдіть до <strong>КЦ → це замовлення</strong> і виберіть місто/відділення через пошук.
            </div>
          ) : (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-400">
              Доставка: {order.deliveryCity} — {order.deliveryAddress}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Вага (кг) *</label>
              <input className="input" type="number" step="0.1" min="0.1" value={ttnForm.weight} onChange={(e) => setTtnForm((p) => ({ ...p, weight: e.target.value }))} />
            </div>
            <div>
              <label className="label">Місць</label>
              <input className="input" type="number" min="1" value={ttnForm.seats} onChange={(e) => setTtnForm((p) => ({ ...p, seats: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Оголошена вартість (₴) *</label>
              <input className="input" type="number" value={ttnForm.cost} onChange={(e) => setTtnForm((p) => ({ ...p, cost: e.target.value }))} />
            </div>
            <div>
              <label className="label">Накладний платіж (₴)</label>
              <input className="input" type="number" value={ttnForm.codAmount} onChange={(e) => setTtnForm((p) => ({ ...p, codAmount: e.target.value }))} placeholder="0 = без НП" />
            </div>
          </div>
          <div>
            <label className="label">Опис вантажу</label>
            <input className="input" value={ttnForm.description} onChange={(e) => setTtnForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Хто платить за доставку</label>
            <select className="input" value={ttnForm.payerType} onChange={(e) => setTtnForm((p) => ({ ...p, payerType: e.target.value as 'Recipient' | 'Sender' }))}>
              <option value="Recipient">Отримувач</option>
              <option value="Sender">Відправник</option>
            </select>
          </div>
          <button
            onClick={handleCreateTtn}
            disabled={ttnLoading || !order.npCityRef || !order.npWarehouseRef}
            className="btn-primary w-full"
          >
            {ttnLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            {ttnLoading ? 'Створення...' : 'Створити ТТН'}
          </button>
        </div>
      </Modal>

      {/* Modals */}
      <OrderForm
        open={editModal}
        onClose={() => setEditModal(false)}
        onSuccess={fetchOrder}
        order={order}
      />

      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        message={`Удалить заказ #${order.orderNum}? Это действие необратимо.`}
        loading={deleteLoading}
      />
    </div>
  );
}
