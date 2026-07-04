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
import { SkeletonRow } from '@/components/ui/Skeleton';
import useHotkeys from '@/hooks/useHotkeys';
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
  ChevronUp,
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
  AlertCircle,
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
  'NEW', 'PROCESSING', 'CONFIRMED', 'CALLED', 'NO_ANSWER', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED',
];

type SortField = 'orderNum' | 'total' | 'createdAt' | 'status';
type SortOrder = 'asc' | 'desc';

// Map a sortable table header to the API sort field. Headers not listed here aren't sortable.
const SORT_FIELDS: Partial<Record<string, SortField>> = {
  orderNum: 'orderNum',
  total: 'total',
  createdAt: 'createdAt',
  status: 'status',
};

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const t = useT();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({ total: 0, page: 1, limit: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [managers, setManagers] = useState<User[]>([]);

  // Smart chips
  const [counters, setCounters] = useState<OrdersCounters>({ slaOverdue: 0, noTtn: 0, noAnswer: 0 });
  const [activeChip, setActiveChip] = useState<ActiveChip>(null);

  // Filters — initialised from the URL so filtered views survive refresh / back and are shareable
  const [search, setSearch] = useState(searchParams.get('search') || '');
  // The debounced search value the fetch actually depends on (D1)
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [managerId, setManagerId] = useState(searchParams.get('managerId') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [hasTtn, setHasTtn] = useState<'' | 'true' | 'false'>(
    (searchParams.get('hasTtn') as '' | 'true' | 'false') || ''
  );
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  // Sorting (D3) — default createdAt desc; backend honours sortBy/sortOrder
  const [sortBy, setSortBy] = useState<SortField>(
    (SORT_FIELDS[searchParams.get('sortBy') || ''] as SortField) || 'createdAt'
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'
  );

  // Saved view
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Selection
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  // Bulk confirm (D4)
  const [confirmBulkStatus, setConfirmBulkStatus] = useState<string | null>(null);
  const [confirmBulkAssign, setConfirmBulkAssign] = useState<{ mid: string | null; name: string } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Keyboard navigation (D6)
  const [focusIndex, setFocusIndex] = useState(-1);

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [bulkTtnModal, setBulkTtnModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const urlTimer = useRef<ReturnType<typeof setTimeout>>();
  const didMount = useRef(false);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  // Порядковый номер запроса списка: устаревший (более ранний) ответ не должен
  // перетирать более свежий результат при быстрой смене фильтров.
  const reqSeq = useRef(0);

  const fetchCounters = useCallback(() => {
    api.get('/orders/counters')
      .then((res) => setCounters(res.data))
      .catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    const myReq = ++reqSeq.current;
    setLoading(true);
    setLoadError(false);
    try {
      const params = {
        page,
        limit: view === 'kanban' ? 200 : 20,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(status && { status }),
        ...(managerId && { managerId }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
        ...(hasTtn && { hasTtn }),
        sortBy,
        sortOrder,
      };
      const res = await api.get('/orders', { params });
      if (myReq !== reqSeq.current) return; // пришёл устаревший ответ — игнорируем
      setOrders(res.data.orders);
      setPagination(res.data.pagination);
    } catch {
      if (myReq !== reqSeq.current) return;
      setLoadError(true);
    }
    if (myReq === reqSeq.current) setLoading(false);
    // Refresh chip counts every time the list reloads
    fetchCounters();
  }, [page, debouncedSearch, status, managerId, dateFrom, dateTo, hasTtn, sortBy, sortOrder, view, fetchCounters]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Выделение действует только в пределах текущей страницы/фильтра: при их смене
  // сбрасываем его, иначе массовые действия и undo затрагивали бы невидимые заказы.
  useEffect(() => {
    setSelected([]);
  }, [page, debouncedSearch, status, managerId, dateFrom, dateTo, hasTtn, view]);

  useEffect(() => {
    api.get('/users').then((res) => setManagers(res.data)).catch(() => {});
  }, []);

  // D1: debounce the actual search VALUE — only one request fires after typing stops.
  useEffect(() => {
    if (search === debouncedSearch) return;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [search, debouncedSearch]);

  // D2: mirror filters/sort into the URL (debounced) so views survive refresh/back & are shareable.
  useEffect(() => {
    // Skip the very first run — state was already hydrated from the URL on mount.
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (managerId) params.set('managerId', managerId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (hasTtn) params.set('hasTtn', hasTtn);
      if (sortBy !== 'createdAt') params.set('sortBy', sortBy);
      if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
      if (page > 1) params.set('page', String(page));
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    }, 300);
    return () => clearTimeout(urlTimer.current);
  }, [search, status, managerId, dateFrom, dateTo, hasTtn, sortBy, sortOrder, page, router]);

  // D3: toggle a column's sort; clicking a new column starts at desc.
  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
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

  // Re-apply a previous status snapshot: group orders by their prior status -> one bulk call each.
  const undoBulkStatus = async (prev: Record<string, OrderStatus>, toastId: string) => {
    toast.dismiss(toastId);
    const byStatus = new Map<OrderStatus, string[]>();
    for (const [id, st] of Object.entries(prev)) {
      const list = byStatus.get(st) || [];
      list.push(id);
      byStatus.set(st, list);
    }
    try {
      await Promise.all(
        Array.from(byStatus.entries()).map(([st, ids]) =>
          api.post('/orders/bulk-status', { ids, status: st })
        )
      );
      toast.success('Статуси повернено');
      fetchOrders();
    } catch {
      toast.error('Не вдалося скасувати');
    }
  };

  // D4: actually run the bulk status change (called after ConfirmDialog), then offer an undo toast.
  const performBulkStatus = async (newStatus: string) => {
    if (!selected.length || !newStatus) return;
    // Snapshot previous statuses of the affected orders for undo.
    const prevStatuses: Record<string, OrderStatus> = {};
    for (const o of orders) {
      if (selected.includes(o.id)) prevStatuses[o.id] = o.status;
    }
    setBulkBusy(true);
    try {
      await api.post('/orders/bulk-status', { ids: selected, status: newStatus });
      const count = selected.length;
      setSelected([]);
      setBulkStatus('');
      setShowBulkMenu(false);
      setConfirmBulkStatus(null);
      fetchOrders();
      toast.success(
        (tt) => (
          <span className="flex items-center gap-3">
            <span>{count} замовлень оновлено</span>
            <button
              onClick={() => undoBulkStatus(prevStatuses, tt.id)}
              className="font-semibold text-primary-600 hover:underline"
            >
              Скасувати
            </button>
          </span>
        ),
        { duration: 10000 }
      );
    } catch {
      toast.error('Ошибка при обновлении');
      setConfirmBulkStatus(null);
    }
    setBulkBusy(false);
  };

  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const performBulkAssign = async (mid: string | null) => {
    if (!selected.length) return;
    setBulkBusy(true);
    try {
      await api.post('/orders/bulk-assign', { ids: selected, managerId: mid });
      toast.success(`Призначено: ${selected.length}`);
      setSelected([]);
      setShowBulkAssign(false);
      setConfirmBulkAssign(null);
      fetchOrders();
    } catch {
      toast.error('Помилка призначення');
      setConfirmBulkAssign(null);
    }
    setBulkBusy(false);
  };

  // Open the assign confirm dialog (resolving a human-readable target name for the prompt).
  const requestBulkAssign = (mid: string | null) => {
    if (!selected.length) return;
    setShowBulkAssign(false);
    const name = mid ? (managers.find((m) => m.id === mid)?.name || 'менеджера') : 'без менеджера';
    setConfirmBulkAssign({ mid, name });
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
      if (managerId) params.set('managerId', managerId);
      if (hasTtn) params.set('hasTtn', hasTtn);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').trim().replace(/\/+$/, '');
      const url = `${base}/api/export/orders?${params}`;
      const token = localStorage.getItem('crm_token');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      // Без этой проверки 401/403 (JSON-ошибка) сохранялись бы как .csv с «успехом».
      if (!res.ok) {
        let msg = 'Помилка експорту';
        try { const j = await res.json(); msg = j.error || msg; } catch { /* keep default */ }
        toast.error(msg);
        return;
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
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
    setDebouncedSearch('');
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
    setDebouncedSearch(f.search || '');
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
    setDebouncedSearch('');
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

  // D6: any open modal/dialog should suspend list hotkeys.
  const anyModalOpen =
    createModal ||
    bulkTtnModal ||
    !!deleteId ||
    bulkDeleteConfirm ||
    confirmBulkStatus !== null ||
    confirmBulkAssign !== null;

  // Reset / clamp the keyboard focus when the visible rows change.
  useEffect(() => {
    setFocusIndex((i) => (orders.length === 0 ? -1 : Math.min(i, orders.length - 1)));
  }, [orders]);

  const moveFocus = (delta: number) => {
    if (!orders.length) return;
    setFocusIndex((i) => {
      const next = Math.max(0, Math.min(orders.length - 1, (i < 0 ? (delta > 0 ? -1 : 0) : i) + delta));
      rowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
      return next;
    });
  };

  useHotkeys(
    {
      // Keys are normalised to lowercase by the hook (e.g. Enter -> 'enter').
      j: () => moveFocus(1),
      k: () => moveFocus(-1),
      enter: () => {
        const o = orders[focusIndex];
        if (o) router.push(`/orders/${o.id}`);
      },
      n: () => {
        if (canEdit) setCreateModal(true);
      },
    },
    { enabled: view === 'table' && !anyModalOpen }
  );

  // D3: a clickable, sortable column header with an up/down chevron on the active column.
  const SortHeader = ({ field, label, className = '' }: { field: SortField; label: string; className?: string }) => {
    const active = sortBy === field;
    return (
      <th className={`text-left table-header p-3 ${className}`}>
        <button
          onClick={() => toggleSort(field)}
          className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          title="Сортувати"
        >
          {label}
          {active && (
            sortOrder === 'asc'
              ? <ChevronUp className="w-3.5 h-3.5 text-primary-600" />
              : <ChevronDown className="w-3.5 h-3.5 text-primary-600" />
          )}
        </button>
      </th>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('orders.title')}</h1>
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <span>{pagination.total} {t('orders.count')}</span>
            {view === 'table' && (
              <span className="hidden lg:inline text-xs text-gray-400">
                <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 font-mono">j</kbd>
                <kbd className="ml-1 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 font-mono">k</kbd>
                <span className="mx-1">навігація</span>
                <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 font-mono">Enter</kbd>
                <span className="mx-1">відкрити</span>
                <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 font-mono">n</kbd>
                <span className="ml-1">новий</span>
              </span>
            )}
          </p>
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
          {canEdit && (
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
                      onClick={() => { setShowBulkMenu(false); setConfirmBulkStatus(s); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {ORDER_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
                      onClick={() => requestBulkAssign(null)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500"
                    >
                      ✕ Зняти менеджера
                    </button>
                    <div className="border-t border-gray-100 dark:border-gray-700" />
                    {managers.filter((m) => ['ADMIN', 'MANAGER', 'CALL_CENTER'].includes(m.role)).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => requestBulkAssign(m.id)}
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
          {/* D7: kanban loads at most 200 — warn when the board is truncated */}
          {!loading && pagination.total > orders.length && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Показано {orders.length} з {pagination.total} — уточніть фільтри
            </div>
          )}
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
                  <SortHeader field="orderNum" label="№" />
                  <th className="text-left table-header p-3">Клиент</th>
                  <th className="text-left table-header p-3 hidden md:table-cell">Товары</th>
                  <SortHeader field="total" label="Сумма" />
                  <SortHeader field="status" label="Статус" />
                  <th className="text-left table-header p-3 hidden sm:table-cell">Источник</th>
                  <th className="text-left table-header p-3 hidden lg:table-cell">Менеджер</th>
                  <SortHeader field="createdAt" label="Дата" className="hidden xl:table-cell" />
                  <th className="p-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  // D5: skeleton placeholder rows instead of a spinner
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={10} />)
                ) : loadError ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-gray-500 dark:text-gray-400">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-400" />
                      <p className="mb-3">Не вдалося завантажити замовлення</p>
                      <button onClick={fetchOrders} className="btn-secondary text-sm mx-auto">
                        <RefreshCw className="w-4 h-4" />
                        Повторити
                      </button>
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
                  orders.map((order, idx) => {
                    const overdue = isOverdueSla(order);
                    const focused = idx === focusIndex;
                    return (
                    <tr
                      key={order.id}
                      ref={(el) => { rowRefs.current[idx] = el; }}
                      onClick={() => setFocusIndex(idx)}
                      className={`border-b transition-colors ${
                        focused ? 'ring-2 ring-inset ring-primary-500 ' : ''
                      }${
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

      {/* D4: confirm bulk status change */}
      <ConfirmDialog
        open={confirmBulkStatus !== null}
        onClose={() => setConfirmBulkStatus(null)}
        onConfirm={() => confirmBulkStatus && performBulkStatus(confirmBulkStatus)}
        title="Зміна статусу"
        message={`Змінити статус ${selected.length} замовлень${
          confirmBulkStatus ? ` на «${ORDER_STATUS_LABELS[confirmBulkStatus as OrderStatus]}»` : ''
        }?`}
        confirmLabel="Змінити"
        loading={bulkBusy}
      />

      {/* D4: confirm bulk assign */}
      <ConfirmDialog
        open={confirmBulkAssign !== null}
        onClose={() => setConfirmBulkAssign(null)}
        onConfirm={() => confirmBulkAssign && performBulkAssign(confirmBulkAssign.mid)}
        title="Призначення менеджера"
        message={`Призначити ${selected.length} замовлень: ${confirmBulkAssign?.name ?? ''}?`}
        confirmLabel="Призначити"
        loading={bulkBusy}
      />
    </div>
  );
}
