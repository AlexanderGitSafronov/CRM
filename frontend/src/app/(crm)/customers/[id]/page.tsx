'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import type { Customer, Order } from '@/types';
import { ORDER_SOURCE_LABELS } from '@/types';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Edit,
  Save,
  X,
  TrendingUp,
  ShoppingCart,
  Calendar,
  ShieldAlert,
} from 'lucide-react';

interface FullCustomer extends Customer {
  orders: Array<Order & { items: Array<{ name: string; quantity: number; price: number }> }>;
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [customer, setCustomer] = useState<FullCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', city: '', address: '', notes: '' });

  const fetchCustomer = async () => {
    try {
      const res = await api.get(`/customers/${id}`);
      setCustomer(res.data);
      setForm({
        name: res.data.name,
        email: res.data.email || '',
        city: res.data.city || '',
        address: res.data.address || '',
        notes: res.data.notes || '',
      });
    } catch {
      toast.error('Клиент не найден');
      router.replace('/customers');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  const [blacklistLoading, setBlacklistLoading] = useState(false);

  const handleToggleBlacklist = async () => {
    if (!customer) return;
    const isBlacklisted = !customer.isBlacklisted;
    let blacklistReason: string | null = null;
    if (isBlacklisted) {
      blacklistReason = prompt('Причина (необов\'язково):') ?? '';
    }
    setBlacklistLoading(true);
    try {
      await api.patch(`/customers/${id}/blacklist`, { isBlacklisted, blacklistReason });
      toast.success(isBlacklisted ? 'Клієнта додано до чорного списку' : 'Клієнта знято з чорного списку');
      fetchCustomer();
    } catch {
      toast.error('Помилка');
    }
    setBlacklistLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/customers/${id}`, form);
      toast.success('Клиент обновлён');
      setEditing(false);
      fetchCustomer();
    } catch {
      toast.error('Ошибка сохранения');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!customer) return null;

  const canEdit = user?.role !== 'VIEWER';
  const ltv = customer.orders?.reduce((s, o) => s + o.total, 0) ?? 0;
  const avgOrder = customer.orders?.length ? ltv / customer.orders.length : 0;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Blacklist warning */}
      {customer.isBlacklisted && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl p-4">
          <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400">Клієнт у чорному списку</p>
            {customer.blacklistReason && (
              <p className="text-sm text-red-600 dark:text-red-500 mt-0.5">{customer.blacklistReason}</p>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/customers" className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <span className="text-lg font-bold text-primary-700 dark:text-primary-400">
            {customer.name?.[0]?.toUpperCase()}
          </span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{customer.name}</h1>
            {customer.isBlacklisted && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">
                <ShieldAlert className="w-3 h-3" /> Чорний список
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">{customer.phone}</p>
        </div>
        {canEdit && (
          editing ? (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="btn-secondary">
                <X className="w-4 h-4" /> Отмена
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Save className="w-4 h-4" />}
                Сохранить
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(true)} className="btn-secondary">
                <Edit className="w-4 h-4" /> Редактировать
              </button>
              <button
                onClick={handleToggleBlacklist}
                disabled={blacklistLoading}
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  customer.isBlacklisted
                    ? 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-green-400 hover:text-green-600'
                    : 'border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                {customer.isBlacklisted ? 'Зняти' : 'Чорний список'}
              </button>
            </div>
          )
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <ShoppingCart className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{customer.orders?.length ?? 0}</p>
          <p className="text-xs text-gray-400">Заказов</p>
        </div>
        <div className="card p-4 text-center">
          <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(ltv)}</p>
          <p className="text-xs text-gray-400">LTV</p>
        </div>
        <div className="card p-4 text-center">
          <Calendar className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(avgOrder)}</p>
          <p className="text-xs text-gray-400">Средний чек</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Customer info */}
        <div className="card p-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Контактная информация</h2>
          <div className="space-y-3">
            {editing ? (
              <>
                <div>
                  <label className="label">Имя</label>
                  <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
                </div>
                <div>
                  <label className="label">Город</label>
                  <input className="input" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} placeholder="Киев" />
                </div>
                <div>
                  <label className="label">Адрес</label>
                  <input className="input" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="ул. Примерная, 1" />
                </div>
                <div>
                  <label className="label">Заметки</label>
                  <textarea className="input min-h-[72px] resize-none" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${customer.phone}`} className="text-gray-700 dark:text-gray-300 hover:text-primary-600">{customer.phone}</a>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${customer.email}`} className="text-gray-700 dark:text-gray-300 hover:text-primary-600">{customer.email}</a>
                  </div>
                )}
                {customer.city && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">{customer.city}</span>
                  </div>
                )}
                {customer.address && (
                  <p className="text-sm text-gray-500 ml-6">{customer.address}</p>
                )}
                {customer.notes && (
                  <div className="mt-3 p-2.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-xs text-yellow-700 dark:text-yellow-400">
                    {customer.notes}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Orders history */}
        <div className="md:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">История заказов</h2>
            <span className="text-xs text-gray-400">{customer.orders?.length ?? 0} заказов</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <th className="text-left table-header p-3">№</th>
                  <th className="text-left table-header p-3">Товары</th>
                  <th className="text-left table-header p-3">Сумма</th>
                  <th className="text-left table-header p-3">Статус</th>
                  <th className="text-left table-header p-3 hidden sm:table-cell">Источник</th>
                  <th className="text-left table-header p-3 hidden md:table-cell">Дата</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      Заказов нет
                    </td>
                  </tr>
                ) : (
                  customer.orders?.map((order) => (
                    <tr key={order.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="p-3">
                        <Link href={`/orders/${order.id}`} className="font-semibold text-primary-600 hover:underline text-sm">
                          #{order.orderNum}
                        </Link>
                      </td>
                      <td className="p-3">
                        <p className="text-xs text-gray-600 dark:text-gray-400 max-w-[160px] truncate">
                          {order.items?.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className="text-sm font-semibold">{formatCurrency(order.total)}</span>
                      </td>
                      <td className="p-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <span className="text-xs text-gray-400">{ORDER_SOURCE_LABELS[order.source] || order.source}</span>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <span className="text-xs text-gray-400">{formatDateTime(order.createdAt)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
