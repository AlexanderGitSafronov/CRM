'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { ORDER_STATUS_LABELS, type Order, type OrderStatus } from '@/types';
import { Search, Phone, ChevronRight, RefreshCw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const CC_FILTERS: { label: string; value: string }[] = [
  { label: 'Все', value: 'ALL' },
  { label: 'Новые', value: 'NEW' },
  { label: 'Недозвон', value: 'NO_ANSWER' },
  { label: 'Прозвонили', value: 'CALLED' },
  { label: 'Подтверждён', value: 'CONFIRMED' },
  { label: 'Отказ', value: 'CANCELLED' },
];

export default function CcOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/orders', { params });
      setOrders(res.data.orders);
      setTotalPages(res.data.pagination.pages);
      setTotal(res.data.pagination.total);
    } catch {}
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Reset page when filter/search changes
  useEffect(() => { setPage(1); }, [statusFilter, search]);

  // Real-time: refresh list silently when new order arrives (SSE dispatched from layout)
  useEffect(() => {
    const onNew = () => load(true);
    window.addEventListener('cc:new_order', onNew);
    return () => window.removeEventListener('cc:new_order', onNew);
  }, [load]);

  return (
    <div className="space-y-4">
      {/* Title + refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Заказы</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{total} заказов</p>
        </div>
        <button
          onClick={() => load()}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по имени или телефону..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {CC_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Phone className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Заказов не найдено</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/cc/orders/${order.id}`}
              className="card flex items-center gap-4 p-4 hover:shadow-md transition-shadow group"
            >
              {/* Order number */}
              <div className="shrink-0 w-14 text-center">
                <p className="text-xs text-gray-400">№</p>
                <p className="font-bold text-gray-900 dark:text-white">#{order.orderNum}</p>
              </div>

              <div className="w-px h-10 bg-gray-100 dark:bg-gray-700 shrink-0" />

              {/* Customer */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{order.customer.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{order.customer.phone}</p>
              </div>

              {/* Products */}
              <div className="hidden sm:block flex-1 min-w-0">
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                </p>
              </div>

              {/* Status + date */}
              <div className="shrink-0 text-right space-y-1">
                <StatusBadge status={order.status as OrderStatus} />
                <div className="flex items-center justify-end gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {formatDate(order.createdAt)}
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 group-hover:text-gray-500 transition-colors" />
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            ← Назад
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
