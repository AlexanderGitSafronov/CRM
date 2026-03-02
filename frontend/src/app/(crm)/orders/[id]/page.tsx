'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { formatCurrency, formatDateTime, formatRelative } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import OrderForm from '@/components/orders/OrderForm';
import type { Order, OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS, ORDER_SOURCE_LABELS } from '@/types';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
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
} from 'lucide-react';

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

  const fetchOrder = async () => {
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data);
    } catch {
      toast.error('Заказ не найден');
      router.replace('/orders');
    }
    setLoading(false);
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
              <p className="font-medium text-gray-900 dark:text-white">{order.customer.name}</p>
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
          {(order.deliveryService || order.deliveryCity || order.deliveryAddress || order.recipientName) && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Доставка</h2>
              </div>
              <div className="space-y-1.5 text-sm">
                {order.deliveryService && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Спосіб</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {DELIVERY_SERVICE_LABELS[order.deliveryService] || order.deliveryService}
                    </span>
                  </div>
                )}
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
              </div>
            </div>
          )}
        </div>
      </div>

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
