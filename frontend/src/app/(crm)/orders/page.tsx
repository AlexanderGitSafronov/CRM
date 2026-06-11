'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import OrderForm from '@/components/orders/OrderForm';
import KanbanBoard from '@/components/orders/KanbanBoard';
import BulkTtnModal from '@/components/orders/BulkTtnModal';
import type { Order, OrderStatus, Pagination as PaginationType, User } from '@/types';
import { ORDER_STATUS_LABELS, ORDER_SOURCE_LABELS } from '@/types';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/stores/localeStore';
import {
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List,
  Download,
  CheckSquare,
  ChevronDown,
  X,
  RefreshCw,
  Clock,
  Truck,
  UserCheck,
  Trash2,
  Copy,
  Printer,
  PhoneOff,
  PackageX,
} from 'lucide-react';
import SlaBadge from '@/components/SlaBadge';
import SavedOrderViews, { OrderFilters } from '@/components/SavedOrderViews';

const SLA_HOURS = 2;

// Extra fields delivered by the API (see batch-3 contract) that aren't yet on the shared Order type.
type OrderRow = Order & {
  duplicateOfId?: string | null;
  duplicateOfNum?: number | null;
};

interface OrdersCounters {
  slaOverdue: number;
  noTtn: number;
  noAnswer: number;
}

type ActiveChip = 'sla' | 'noTtn' | 'noAnswer' | null;

function isOverdueSla(order: Order): boolean {
  if (order.status !== 'NEW') return false;
  return Date.now() - new Date(order.createdAt).getTime() > SLA_HOURS * 60 * 60 * 1000;
}

const STATUSES: OrderStatus[] = [
  'NEW', 'PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED',
];

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const t = useT();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({ total: 0, page: 1, limit: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [managers, setManagers] = useState<User[]>([]);

  // Smart chips
  const [counters, setCounters] = useState<OrdersCounters>({ slaOverdue: 0, noTtn: 0, noAnswer: 0 });
  const [activeChip, setActiveChip] = useState<ActiveChip>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [managerId, setManagerId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hasTtn, setHasTtn] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);

  // Saved view
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Selection
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [bulkTtnModal, setBulkTtnModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const fetchCounters = useCallback(() => {
    api.get('/orders/counters')
      .then((res) => setCounters(res.data))
      .catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: view === 'kanban' ? 200 : 20,
        ...(search && { search }),
        ...(status && { status }),
        ...(managerId && { managerId }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
        ...(hasTtn && { hasTtn }),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };
      const res = await api.get('/orders', { params });
      setOrders(res.data.orders);
      setPagination(res.data.pagination);
    } catch {}
    setLoading(false);
    // Refresh chip counts every time the list reloads
    fetchCounters();
  }, [page, search, status, managerId, dateFrom, dateTo, hasTtn, view, fetchCounters]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    api.get('/users').then((res) => setManagers(res.data)).catch(() => {});
  }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setPage(1), 400);
  };

  // Orders matching the current selection, in current page order
  const selectedOrders = orders.filter((o) => selected.includes(o.id));
  // Selected orders that already have a TTN (eligible for combined print)
  const printableIds = selectedOrders.filter((o) => o.trackingNumber).map((o) => o.id);

  const handleBulkPrint = async () => {
    if (!printableIds.length) return;
    setPrintLoading(true);
    try {
      const res = await api.get('/nova-poshta/print-ttn', {
        params: { orderIds: printableIds.join(','), format: 'pdf', size: '100x100' },
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(res.data);
      const w = window.open(blobUrl, '_blank');
      if (!w) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `TTN-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err: unknown) {
      let msg = 'Помилка друку';
      const errResp = (err as { response?: { data?: unknown } })?.response;
      if (errResp?.data instanceof Blob) {
        try {
          const j = JSON.parse(await errResp.data.text());
          msg = j.error || msg;
        } catch { /* keep default */ }
      } else if (typeof errResp?.data === 'object' && errResp.data && 'error' in errResp.data) {
        msg = (errResp.data as { error: string }).error;
      }
      toast.error(msg);
    }
    setPrintLoading(false);
  };

  const handleBulkStatus = async () => {
    if (!selected.length || !bulkStatus) return;
    try {
      await api.post('/orders/bulk-status', { ids: selected, status: bulkStatus });
      toast.success(`${selected.length} заказов обновлено`);
      setSelected([]);
      setBulkStatus('');
      setShowBulkMenu(false);
      fetchOrders();
    } catch {
      toast.error('Ошибка при обновлении');
    }
  };

  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const handleBulkAssign = async (mid: string | null) => {
    if (!selected.length) return;
    try {
      await api.post('/orders/bulk-assign', { ids: selected, managerId: mid });
      toast.success(`Призначено: ${selected.length}`);
      setSelected([]);
      setShowBulkAssign(false);
      fetchOrders();
    } catch {
      toast.error('Помилка призначення');
    }
  };

  const handleBulkDelete = async () => {
    if (!selected.length) return;
    try {
      const res = await api.post('/orders/bulk-delete', { ids: selected });
      toast.success(`Видалено: ${res.data.deleted}`);
      setSelected([]);
      setBulkDeleteConfirm(false);
      fetchOrders();
    } catch {
      toast.error('Помилка видалення');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/orders/${deleteId}`);
      toast.success('Заказ удалён');
      setDeleteId(null);
      fetchOrders();
    } catch {
      toast.error('Ошибка при удалении');
    }
    setDeleteLoading(false);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/export/orders?${params}`;
      const token = localStorage.getItem('crm_token');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('Экспорт готов');
    } catch {
      toast.error('Ошибка экспорта');
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selected.length === orders.length) {
      setSelected([]);
    } else {
      setSelected(orders.map((o) => o.id));
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setManagerId('');
    setDateFrom('');
    setDateTo('');
    setHasTtn('');
    setActiveChip(null);
    setPage(1);
    setActiveViewId(null);
  };

  const applyView = (f: OrderFilters) => {
    setSearch(f.search || '');
    setStatus(f.status || '');
    setManagerId(f.managerId || '');
    setDateFrom(f.dateFrom || '');
    setDateTo(f.dateTo || '');
    setHasTtn('');
    setActiveChip(null);
    setPage(1);
  };

  // Smart chips: each toggles a curated combination of existing filters
  const applyChip = (chip: Exclude<ActiveChip, null>) => {
    // Toggle off if already active -> back to a clean slate
    if (activeChip === chip) {
      clearFilters();
      return;
    }
    setActiveChip(chip);
    setActiveViewId(null);
    setSearch('');
    setManagerId('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    if (chip === 'sla') {
      // Overdue SLA = NEW orders that have aged past the SLA window (visually flagged in-row)
      setStatus('NEW');
      setHasTtn('');
    } else if (chip === 'noTtn') {
      setStatus('CONFIRMED');
      setHasTtn('false');
    } else if (chip === 'noAnswer') {
      setStatus('NO_ANSWER');
      setHasTtn('');
    }
  };

  const currentFilters: OrderFilters = {
    ...(search && { search }),
    ...(status && { status }),
    ...(managerId && { managerId }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  };

  const hasFilters = search || status || managerId || dateFrom || dateTo || hasTtn;
  const canEdit = user?.role !== 'VIEWER';

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('orders.title')}</h1>
          <p className="text-sm text-gray-400">{pagination.total} {t('orders.count')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setView('table')}
              className={`p-1.5 rounded-md transition-colors ${view === 'table' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600' : 'text-gray-500'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`p-1.5 rounded-md transition-colors ${view === 'kanban' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600' : 'text-gray-500'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t('common.export')}</span>
          </button>

          {canEdit && (
            <button onClick={() => setCreateModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('orders.new')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Saved views */}
      <SavedOrderViews
        currentFilters={currentFilters}
        onApply={applyView}
        activeViewId={activeViewId}
        onActiveViewChange={setActiveViewId}
      />

      {/* Smart chips — quick triage by live counters */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => applyChip('sla')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
            activeChip === 'sla'
              ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 font-medium'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-rose-300'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Прострочені SLA
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-xs font-semibold ${
            activeChip === 'sla'
              ? 'bg-rose-600 text-white'
              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
          }`}>
            {counters.slaOverdue}
          </span>
        </button>

        <button
          onClick={() => applyChip('noTtn')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
            activeChip === 'noTtn'
              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 font-medium'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-orange-300'
          }`}
        >
          <PackageX className="w-3.5 h-3.5" />
          Без ТТН
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-xs font-semibold ${
            activeChip === 'noTtn'
              ? 'bg-orange-600 text-white'
              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
          }`}>
            {counters.noTtn}
          </span>
        </button>

        <button
          onClick={() => applyChip('noAnswer')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
            activeChip === 'noAnswer'
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-amber-300'
          }`}
        >
          <PhoneOff className="w-3.5 h-3.5" />
          Недозвони
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-xs font-semibold ${
            activeChip === 'noAnswer'
              ? 'bg-amber-600 text-white'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
          }`}>
            {counters.noAnswer}
          </span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder={t('orders.searchPlaceholder')}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          <select
            className="input w-auto"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setActiveChip(null); setPage(1); }}
          >
            <option value="">{t('orders.allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
            ))}
          </select>

          <select
            className="input w-auto"
            value={hasTtn}
            onChange={(e) => { setHasTtn(e.target.value as '' | 'true' | 'false'); setActiveChip(null); setPage(1); }}
            title="ТТН"
          >
            <option value="">Усі ТТН</option>
            <option value="true">З ТТН</option>
            <option value="false">Без ТТН</option>
          </select>

          <select
            className="input w-auto"
            value={managerId}
            onChange={(e) => { setManagerId(e.target.value); setPage(1); }}
          >
            <option value="">{t('orders.allManagers')}</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          <input
            type="date"
            className="input w-auto"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            title="Дата от"
          />
          <input
            type="date"
            className="input w-auto"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            title="Дата до"
          />

          {hasFilters && (
            <button onClick={clearFilters} className="btn-secondary">
              <X className="w-4 h-4" />
              Сбросить
            </button>
          )}

          <button onClick={fetchOrders} className="btn-secondary p-2" title="Обновить">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
          <CheckSquare className="w-4 h-4 text-primary-600" />
          <span className="text-sm font-medium text-primary-700 dark:text-primary-400">
            Выбрано: {selected.length}
          </span>
          <div className="relative">
            <button
              onClick={() => setShowBulkMenu(!showBulkMenu)}
              className="btn-secondary text-sm"
            >
              Изменить статус
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showBulkMenu && (
              <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 w-44">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setBulkStatus(s); setShowBulkMenu(false); setTimeout(handleBulkStatus, 0); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {ORDER_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
          {canEdit && (
            <>
              {/* Assign manager */}
              <div className="relative">
                <button
                  onClick={() => setShowBulkAssign(!showBulkAssign)}
                  className="btn-secondary text-sm flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Призначити
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showBulkAssign && (
                  <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 w-56 max-h-72 overflow-y-auto">
                    <button
                      onClick={() => handleBulkAssign(null)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500"
                    >
                      ✕ Зняти менеджера
                    </button>
                    <div className="border-t border-gray-100 dark:border-gray-700" />
                    {managers.filter((m) => ['ADMIN', 'MANAGER', 'CALL_CENTER'].includes(m.role)).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleBulkAssign(m.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        {m.name} <span className="text-xs text-gray-400">({m.role})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setBulkTtnModal(true)}
                className="btn-secondary text-sm flex items-center gap-1.5 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20"
              >
                <Truck className="w-3.5 h-3.5" />
                Створити ТТН
              </button>

              <button
                onClick={handleBulkPrint}
                disabled={printLoading || printableIds.length === 0}
                title={printableIds.length === 0 ? 'Немає ТТН для друку серед обраних' : `Друк ${printableIds.length} ТТН одним PDF`}
                className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                {printLoading ? 'Друк...' : `Друк ТТН${printableIds.length ? ` (${printableIds.length})` : ''}`}
              </button>

              {user?.role === 'ADMIN' && (
                <button
                  onClick={() => setBulkDeleteConfirm(true)}
                  className="btn-secondary text-sm flex items-center gap-1.5 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Видалити
                </button>
              )}
            </>
          )}
          <button
            onClick={() => setSelected([])}
            className="ml-auto text-sm text-gray-500 hover:text-gray-700"
          >
            Скасувати
          </button>
        </div>
      )}

      {/* Content */}
      {view === 'kanban' ? (
        <div className="card p-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <KanbanBoard orders={orders} onOrderUpdate={fetchOrders} />
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={selected.length === orders.length && orders.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left table-header p-3">№</th>
                  <th className="text-left table-header p-3">Клиент</th>
                  <th className="text-left table-header p-3 hidden md:table-cell">Товары</th>
                  <th className="text-left table-header p-3">Сумма</th>
                  <th className="text-left table-header p-3">Статус</th>
                  <th className="text-left table-header p-3 hidden sm:table-cell">Источник</th>
                  <th className="text-left table-header p-3 hidden lg:table-cell">Менеджер</th>
                  <th className="text-left table-header p-3 hidden xl:table-cell">Дата</th>
                  <th className="p-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-gray-400">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>Заказов не найдено</p>
                      {hasFilters && (
                        <button onClick={clearFilters} className="mt-2 text-primary-600 hover:underline text-sm">
                          Сбросить фильтры
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const overdue = isOverdueSla(order);
                    return (
                    <tr
                      key={order.id}
                      className={`border-b transition-colors ${
                        overdue
                          ? 'border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                          : 'border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30'
                      }`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(order.id)}
                          onChange={() => toggleSelect(order.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            href={`/orders/${order.id}`}
                            className="font-semibold text-primary-600 hover:underline text-sm"
                          >
                            #{order.orderNum}
                          </Link>
                          <SlaBadge status={order.status} createdAt={order.createdAt} />
                          {order.duplicateOfNum != null && (
                            order.duplicateOfId ? (
                              <Link
                                href={`/orders/${order.duplicateOfId}`}
                                title="Можливий дублікат"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                              >
                                <Copy className="w-3 h-3" />
                                Дубль #{order.duplicateOfNum}
                              </Link>
                            ) : (
                              <span
                                title="Можливий дублікат"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                              >
                                <Copy className="w-3 h-3" />
                                Дубль #{order.duplicateOfNum}
                              </span>
                            )
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div>
                          <Link
                            href={`/customers/${order.customer.id}`}
                            className="text-sm font-medium text-gray-900 dark:text-white hover:text-primary-600"
                          >
                            {order.customer.name}
                          </Link>
                          <p className="text-xs text-gray-400">{order.customer.phone}</p>
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <p className="text-xs text-gray-600 dark:text-gray-400 max-w-[180px] truncate">
                          {order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(order.total)}
                        </span>
                      </td>
                      <td className="p-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <span className="text-xs text-gray-500">
                          {ORDER_SOURCE_LABELS[order.source] || order.source}
                        </span>
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-500">
                          {order.manager?.name || '—'}
                        </span>
                      </td>
                      <td className="p-3 hidden xl:table-cell">
                        <span className="text-xs text-gray-400">
                          {formatDateTime(order.createdAt)}
                        </span>
                      </td>
                      <td className="p-3">
                        {user?.role === 'ADMIN' && (
                          <button
                            onClick={() => setDeleteId(order.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                            title="Удалить"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={pagination.page}
            pages={pagination.pages}
            total={pagination.total}
            limit={pagination.limit}
            onChange={(p) => setPage(p)}
          />
        </div>
      )}

      {/* Modals */}
      <OrderForm
        open={createModal}
        onClose={() => setCreateModal(false)}
        onSuccess={fetchOrders}
      />

      <BulkTtnModal
        open={bulkTtnModal}
        onClose={() => setBulkTtnModal(false)}
        orders={selectedOrders}
        onDone={fetchOrders}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Вы уверены, что хотите удалить этот заказ? Это действие необратимо."
        loading={deleteLoading}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        message={`Видалити ${selected.length} заказів? Це незворотно.`}
      />
    </div>
  );
}
