'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Expense } from '@/types';
import { EXPENSE_CATEGORY_LABELS } from '@/types';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  BarChart2,
  Plus,
  Trash2,
  Calendar,
  Download,
  AlertTriangle,
  RefreshCw,
  Truck,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface DayData { date: string; orders: number; revenue: number }
interface ManagerData { manager: string; revenue: number; orders: number }
type Verdict = 'scale' | 'optimize' | 'disable';
interface ProductData {
  name: string;
  revenue: number;
  quantity: number;
  cost: number;
  profit: number;
  returned: number;
  redemptionRate: number;
  marginPerUnit?: number;
  trendPct?: number | null;
  verdict?: Verdict;
}

interface ReturnsCostData {
  totalReturns: number;
  lostShipping: number;
  frozenCogs: number;
  totalLoss: number;
  byProduct: { name: string; count: number; frozenCogs: number }[];
  bySource: { source: string; count: number }[];
}

interface InTransitData {
  inTransitTotal: number;
  expectedPayout: number;
  avgLagDays: number;
  expectedByDate: { date: string; amount: number }[];
}
interface RedemptionData {
  shipped: number;
  delivered: number;
  returned: number;
  resolved: number;
  redemptionRate: number | null;
  prevRedemptionRate: number | null;
  realRevenue: number;
  avgOrderValue: number;
}
interface SourceData {
  source: string;
  label: string;
  total: number;
  converted: number;
  cancelled: number;
  revenue: number;
  conversion: number;
}

interface ManagerConversion {
  manager: string;
  managerId: string;
  total: number;
  confirmed: number;
  cancelled: number;
  stillNew: number;
  conversion: number;
  avgResponseMinutes: number | null;
}

interface LtvCustomer {
  id: string;
  name: string;
  phone: string;
  ordersCount: number;
  ltv: number;
  avgOrder: number;
  firstOrder: string | null;
  lastOrder: string | null;
}
interface LtvData {
  customers: LtvCustomer[];
  repeatBuyers: number;
  totalWithOrders: number;
  repeatRate: number;
  avgLtv: number;
}

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

const VERDICT_META: Record<Verdict, { label: string; cls: string }> = {
  scale: {
    label: 'Масштабувати',
    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  },
  optimize: {
    label: 'Оптимізувати',
    cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  },
  disable: {
    label: 'Вимкнути',
    cls: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  },
};

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Вручну',
  WEBHOOK: 'Вебхук',
  LANDING: 'Лендінг',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  TELEGRAM: 'Telegram',
  PHONE: 'Дзвінок',
  OTHER: 'Інше',
};

const EXPENSE_CATEGORIES = [
  { value: 'ADVERTISING', label: 'Реклама' },
  { value: 'SERVICES', label: 'Услуги' },
  { value: 'PURCHASE', label: 'Закупка' },
  { value: 'OTHER', label: 'Прочее' },
];

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState('30');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [byDay, setByDay] = useState<DayData[]>([]);
  const [byManager, setByManager] = useState<ManagerData[]>([]);
  const [byProduct, setByProduct] = useState<ProductData[]>([]);
  const [conversionByManager, setConversionByManager] = useState<ManagerConversion[]>([]);
  const [bySource, setBySource] = useState<SourceData[]>([]);
  const [redemption, setRedemption] = useState<RedemptionData | null>(null);
  const [returnsCost, setReturnsCost] = useState<ReturnsCostData | null>(null);
  const [inTransit, setInTransit] = useState<InTransitData | null>(null);
  const [ltv, setLtv] = useState<LtvData | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [summary, setSummary] = useState({ revenue: 0, orders: 0, profit: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    category: 'ADVERTISING',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [savingExpense, setSavingExpense] = useState(false);
  const [productSort, setProductSort] = useState<'margin' | 'revenue' | 'redemption'>('margin');

  const buildDateParams = () => {
    if (dateFrom || dateTo) {
      return { ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) };
    }
    const from = new Date();
    from.setDate(from.getDate() - parseInt(period));
    return { dateFrom: from.toISOString().split('T')[0] };
  };

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    const params = buildDateParams();
    try {
      const [dayRes, managerRes, conversionRes, sourceRes, productRes, expenseRes, summaryRes, redemptionRes, ltvRes] = await Promise.all([
        api.get('/analytics/orders-by-day', { params: { days: period } }),
        api.get('/analytics/revenue-by-manager', { params }),
        api.get('/analytics/conversion-by-manager', { params }),
        api.get('/analytics/revenue-by-source', { params }),
        api.get('/analytics/revenue-by-product', { params: { ...params, limit: 10 } }),
        api.get('/analytics/expenses', { params: { ...params, limit: 100 } }),
        api.get('/analytics/summary', { params }),
        api.get('/analytics/redemption-rate', { params }),
        api.get('/analytics/customer-ltv', { params: { ...params, limit: 15 } }),
      ]);
      setByDay(dayRes.data);
      setByManager(managerRes.data);
      setConversionByManager(conversionRes.data);
      setBySource(sourceRes.data);
      setByProduct(productRes.data);
      setExpenses(expenseRes.data.expenses);
      setTotalExpenses(expenseRes.data.total);
      setRedemption(redemptionRes.data);
      setLtv(ltvRes.data);
      const s = summaryRes.data;
      setSummary({ revenue: s.revenue, orders: s.orders.total, profit: s.profit });
    } catch {
      setError(true);
    }
    // Returns-cost and cash-in-transit are additive panels — fetched resiliently so a
    // slow/absent endpoint never blanks the page or trips the error state above.
    // Send both from/to (brief contract) and dateFrom/dateTo (page-wide convention) so the
    // panel respects period presets regardless of which the backend reads.
    const p = params as { dateFrom?: string; dateTo?: string };
    const moneyParams = {
      ...params,
      ...(p.dateFrom && { from: p.dateFrom }),
      ...(p.dateTo && { to: p.dateTo }),
    };
    api
      .get('/analytics/returns-cost', { params: moneyParams })
      .then((r) => setReturnsCost(r.data))
      .catch(() => setReturnsCost(null));
    api
      .get('/analytics/cash-in-transit')
      .then((r) => setInTransit(r.data))
      .catch(() => setInTransit(null));
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [period, dateFrom, dateTo]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      toast.error('Введите сумму');
      return;
    }
    setSavingExpense(true);
    try {
      await api.post('/analytics/expenses', expenseForm);
      toast.success('Расход добавлен');
      setShowExpenseForm(false);
      setExpenseForm({ category: 'ADVERTISING', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch {
      toast.error('Ошибка');
    }
    setSavingExpense(false);
  };

  const handleDeleteExpense = async () => {
    if (!deleteExpenseId) return;
    try {
      await api.delete(`/analytics/expenses/${deleteExpenseId}`);
      toast.success('Расход удалён');
      setDeleteExpenseId(null);
      fetchData();
    } catch {
      toast.error('Ошибка');
    }
  };

  const canEdit = user?.role !== 'VIEWER';

  // Default-sort the ROI table by net margin (profit) desc; the header lets the owner flip
  // to revenue or redemption. Sort on a copy so we never mutate the fetched array.
  const sortedProducts = [...byProduct].sort((a, b) => {
    if (productSort === 'revenue') return b.revenue - a.revenue;
    if (productSort === 'redemption') return (b.redemptionRate ?? 0) - (a.redemptionRate ?? 0);
    return b.profit - a.profit;
  });

  const handleExportFinances = async () => {
    const params = buildDateParams();
    const query = new URLSearchParams(params as Record<string, string>).toString();
    const token = localStorage.getItem('crm_token');
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiBase}/api/export/finances?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { toast.error('Ошибка экспорта'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finances_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Аналитика</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          {/* Period selector */}
          <select
            className="input w-auto text-sm"
            value={period}
            onChange={(e) => { setPeriod(e.target.value); setDateFrom(''); setDateTo(''); }}
          >
            <option value="7">7 дней</option>
            <option value="14">14 дней</option>
            <option value="30">30 дней</option>
            <option value="60">60 дней</option>
            <option value="90">90 дней</option>
          </select>
          <input type="date" className="input w-auto text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="От" />
          <input type="date" className="input w-auto text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="До" />
          <button
            onClick={handleExportFinances}
            className="btn btn-secondary flex items-center gap-1.5 text-sm"
            title="Экспорт финансов в CSV"
          >
            <Download className="w-4 h-4" />
            Экспорт
          </button>
        </div>
      </div>

      {/* Inline error state */}
      {error && !loading && (
        <div className="card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">Не вдалося завантажити</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Перевірте з'єднання та спробуйте ще раз.
            </p>
          </div>
          <button onClick={fetchData} className="btn-primary shrink-0">
            <RefreshCw className="w-4 h-4" />
            Повторити
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div>
            <p className="text-sm text-gray-500">Выручка</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(summary.revenue)}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <p className="text-sm text-gray-500">Расходы</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <p className="text-sm text-gray-500">Чистая прибыль</p>
            <p className={`text-2xl font-bold mt-1 ${summary.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(summary.profit)}
            </p>
            {summary.revenue > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">
                Маржа: {((summary.profit / summary.revenue) * 100).toFixed(1)}%
              </p>
            )}
          </div>
          <div className="w-11 h-11 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </div>

      {/* Redemption rate block */}
      {redemption && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">% Выкупа посылок</h2>
            <span className="text-xs text-gray-400 ml-1">(DELIVERED / DELIVERED + RETURNED)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {redemption.redemptionRate !== null ? `${redemption.redemptionRate}%` : '—'}
              </p>
              <p className="text-xs text-gray-400 mt-1">% выкупа</p>
              {redemption.prevRedemptionRate !== null && (
                <p className={`text-xs mt-0.5 font-medium ${
                  (redemption.redemptionRate ?? 0) >= redemption.prevRedemptionRate
                    ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {(redemption.redemptionRate ?? 0) >= redemption.prevRedemptionRate ? '↑' : '↓'}
                  {' '}пред. {redemption.prevRedemptionRate}%
                </p>
              )}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{redemption.delivered}</p>
              <p className="text-xs text-gray-400 mt-1">Доставлено</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">{redemption.returned}</p>
              <p className="text-xs text-gray-400 mt-1">Возвратов</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-500">{redemption.shipped}</p>
              <p className="text-xs text-gray-400 mt-1">В пути</p>
            </div>
          </div>
          {redemption.resolved > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Доставлено: {redemption.delivered}</span>
                <span>Возвраты: {redemption.returned}</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${redemption.redemptionRate ?? 0}%` }}
                />
                <div
                  className="h-full bg-red-400"
                  style={{ width: `${100 - (redemption.redemptionRate ?? 0)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Returns cost — how much money returns ate */}
      {returnsCost && (returnsCost.totalLoss > 0 || returnsCost.totalReturns > 0) && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Вартість повернень</h2>
            <span className="text-xs text-gray-400 ml-1">{returnsCost.totalReturns} повернень</span>
          </div>

          <div className="rounded-xl bg-red-50 dark:bg-red-900/15 p-4 mb-4">
            <p className="text-sm text-red-700 dark:text-red-300">
              Повернення зʼїли{' '}
              <span className="text-2xl font-bold align-middle">{formatCurrency(returnsCost.totalLoss)}</span>
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-red-600/80 dark:text-red-300/70">
              <span>Втрачена доставка: <b>{formatCurrency(returnsCost.lostShipping)}</b></span>
              <span>Заморожена собівартість: <b>{formatCurrency(returnsCost.frozenCogs)}</b></span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* By product */}
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2">Найбільше повернень по товарах</p>
              {returnsCost.byProduct.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Немає даних</p>
              ) : (
                <div className="space-y-2">
                  {returnsCost.byProduct.slice(0, 6).map((p, i) => {
                    const maxCogs = Math.max(...returnsCost.byProduct.map((x) => x.frozenCogs), 1);
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[60%]">{p.name}</span>
                          <span className="text-gray-500 whitespace-nowrap">
                            {p.count} шт · {formatCurrency(p.frozenCogs)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-400 rounded-full transition-all"
                            style={{ width: `${(p.frozenCogs / maxCogs) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* By source */}
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2">Повернення по каналах</p>
              {returnsCost.bySource.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Немає даних</p>
              ) : (
                <div className="space-y-2">
                  {returnsCost.bySource.map((s, i) => {
                    const maxCount = Math.max(...returnsCost.bySource.map((x) => x.count), 1);
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {SOURCE_LABELS[s.source] ?? s.source}
                          </span>
                          <span className="text-gray-500">{s.count} шт</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${(s.count / maxCount) * 100}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cash in transit — money on the road, expected payout */}
      {inTransit && inTransit.inTransitTotal > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="w-4 h-4 text-orange-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Гроші в дорозі</h2>
            <span className="text-xs text-gray-400 ml-1">~{inTransit.avgLagDays} дн. до виплати</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-400">В дорозі</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{formatCurrency(inTransit.inTransitTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Очікуваний прихід</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(inTransit.expectedPayout)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Сер. час доставки</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{inTransit.avgLagDays} дн.</p>
            </div>
          </div>
          {inTransit.expectedByDate && inTransit.expectedByDate.length > 0 && (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={inTransit.expectedByDate}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-100 dark:text-gray-800" />
                <XAxis dataKey="date" tickFormatter={(v) => String(v).slice(5)} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-gray-500" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-gray-500" />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Очікуємо']}
                  labelFormatter={(l) => formatDate(l)}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="amount" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Динамика выручки</h2>
          {loading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={byDay}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-100 dark:text-gray-800" />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-gray-500" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-gray-500" />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Выручка']}
                  labelFormatter={(l) => formatDate(l)}
                  contentStyle={{ fontSize: 12, backgroundColor: 'var(--color-bg)', border: 'none' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Заказы по дням</h2>
          {loading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-100 dark:text-gray-800" />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-gray-500" />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-gray-500" />
                <Tooltip
                  formatter={(v: number) => [v, 'Заказов']}
                  labelFormatter={(l) => formatDate(l)}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="orders" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* By manager */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Продажи по менеджерам</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : byManager.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Нет данных</p>
          ) : (
            <div className="space-y-3">
              {byManager.map((m, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-900 dark:text-white">{m.manager}</span>
                    <span className="text-gray-500">{m.orders} зак. · {formatCurrency(m.revenue)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(m.revenue / Math.max(...byManager.map((x) => x.revenue))) * 100}%`,
                        backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Product ROI table */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Товары: ROI и % выкупа</h2>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : byProduct.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Нет данных</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="pb-2 pr-4 font-medium">Товар</th>
                  <th className="pb-2 pr-4 font-medium text-right">Шт.</th>
                  <th
                    className="pb-2 pr-4 font-medium text-right cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={() => setProductSort('revenue')}
                  >
                    Выручка{productSort === 'revenue' && ' ↓'}
                  </th>
                  <th
                    className="pb-2 pr-4 font-medium text-right cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={() => setProductSort('margin')}
                    title="Чистая маржа (после возвратов)"
                  >
                    Маржа{productSort === 'margin' && ' ↓'}
                  </th>
                  <th className="pb-2 pr-4 font-medium text-right">Маржа/шт</th>
                  <th className="pb-2 pr-4 font-medium text-right">ROI</th>
                  <th
                    className="pb-2 pr-4 font-medium text-right cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={() => setProductSort('redemption')}
                  >
                    % Выкупа{productSort === 'redemption' && ' ↓'}
                  </th>
                  <th className="pb-2 font-medium text-right">Вердикт</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {sortedProducts.map((p, i) => {
                  const roi = p.cost > 0 ? Math.round((p.profit / p.cost) * 100) : null;
                  const marginPerUnit = Number.isFinite(p.marginPerUnit as number)
                    ? (p.marginPerUnit as number)
                    : p.quantity > 0
                    ? p.profit / p.quantity
                    : null;
                  const trend = Number.isFinite(p.trendPct as number) ? (p.trendPct as number) : null;
                  const verdict = p.verdict && VERDICT_META[p.verdict] ? VERDICT_META[p.verdict] : null;
                  return (
                    <tr key={i} className="text-gray-700 dark:text-gray-300">
                      <td className="py-2 pr-4 font-medium max-w-[180px] truncate">{p.name}</td>
                      <td className="py-2 pr-4 text-right text-gray-500">{p.quantity}</td>
                      <td className="py-2 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {formatCurrency(p.revenue)}
                          {trend !== null && trend !== 0 && (
                            <span className={`text-xs font-medium ${trend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {trend > 0 ? '▲' : '▼'}{Math.abs(trend)}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`py-2 pr-4 text-right font-semibold ${p.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {p.cost > 0 ? formatCurrency(p.profit) : '—'}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-500">
                        {marginPerUnit !== null ? formatCurrency(marginPerUnit) : '—'}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {roi !== null ? (
                          <span className={`font-bold ${roi >= 100 ? 'text-emerald-600' : roi >= 30 ? 'text-amber-500' : 'text-red-500'}`}>
                            {roi}%
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <span className={`font-semibold ${p.redemptionRate >= 70 ? 'text-emerald-600' : p.redemptionRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                          {p.redemptionRate}%
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {verdict ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${verdict.cls}`}>
                            {verdict.label}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Analytics by source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pie chart */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Заявки по каналах</h2>
          </div>
          {loading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : bySource.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">Немає даних</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={bySource}
                  dataKey="total"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ label, percent }) =>
                    `${label} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {bySource.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, _name, props) => [
                    `${v} зак. · ${formatCurrency(props.payload.revenue)}`,
                    props.payload.label,
                  ]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Source table */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Виручка по каналах</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : bySource.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">Немає даних</p>
          ) : (
            <div className="space-y-3">
              {bySource.map((s, i) => {
                const maxRevenue = Math.max(...bySource.map((x) => x.revenue));
                return (
                  <div key={s.source}>
                    <div className="flex justify-between items-center text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="font-medium text-gray-900 dark:text-white">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <span className="text-gray-400 text-xs">{s.total} зак. · {s.conversion}%</span>
                        <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(s.revenue)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: maxRevenue > 0 ? `${(s.revenue / maxRevenue) * 100}%` : '0%',
                          backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Conversion by manager */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 p-5 border-b border-gray-100 dark:border-gray-800">
          <Users className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Конверсія менеджерів</h2>
          <span className="text-xs text-gray-400 ml-1">NEW → CONFIRMED</span>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : conversionByManager.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Немає даних за обраний період</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <th className="text-left table-header p-4">Менеджер</th>
                  <th className="text-right table-header p-4">Всього</th>
                  <th className="text-right table-header p-4">Підтверджено</th>
                  <th className="text-right table-header p-4 hidden sm:table-cell">Скасовано</th>
                  <th className="text-right table-header p-4 hidden sm:table-cell">Нові (без реакції)</th>
                  <th className="text-right table-header p-4">Конверсія</th>
                  <th className="text-right table-header p-4 hidden md:table-cell">Сер. відповідь</th>
                </tr>
              </thead>
              <tbody>
                {conversionByManager.map((m, i) => {
                  const convColor =
                    m.conversion >= 60
                      ? 'text-green-600 dark:text-green-400'
                      : m.conversion >= 30
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400';
                  return (
                    <tr
                      key={m.managerId}
                      className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="font-medium text-sm text-gray-900 dark:text-white">
                            {m.manager}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {m.total}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                          {m.confirmed}
                        </span>
                      </td>
                      <td className="p-4 text-right hidden sm:table-cell">
                        <span className="text-sm text-red-500">{m.cancelled}</span>
                      </td>
                      <td className="p-4 text-right hidden sm:table-cell">
                        <span className="text-sm text-gray-400">{m.stillNew}</span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden hidden lg:block">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, m.conversion)}%`,
                                backgroundColor:
                                  m.conversion >= 60 ? '#10b981' : m.conversion >= 30 ? '#f59e0b' : '#ef4444',
                              }}
                            />
                          </div>
                          <span className={`text-sm font-bold ${convColor}`}>
                            {m.conversion}%
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right hidden md:table-cell">
                        <span className="text-sm text-gray-500">
                          {m.avgResponseMinutes !== null
                            ? m.avgResponseMinutes < 60
                              ? `${m.avgResponseMinutes} хв`
                              : `${Math.floor(m.avgResponseMinutes / 60)} год ${m.avgResponseMinutes % 60} хв`
                            : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LTV / Repeat buyers */}
      {ltv && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
            <Users className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">LTV клиентов</h2>
            <div className="ml-auto flex gap-4 text-sm">
              <span className="text-gray-400">Повторные: <span className="font-semibold text-purple-600 dark:text-purple-400">{ltv.repeatBuyers}</span> / {ltv.totalWithOrders} ({ltv.repeatRate}%)</span>
              <span className="text-gray-400">Средний LTV: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(ltv.avgLtv)}</span></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <th className="text-left table-header p-4">Клиент</th>
                  <th className="text-right table-header p-4">Заказов</th>
                  <th className="text-right table-header p-4">LTV</th>
                  <th className="text-right table-header p-4 hidden sm:table-cell">Ср. чек</th>
                  <th className="text-right table-header p-4 hidden md:table-cell">Последний</th>
                </tr>
              </thead>
              <tbody>
                {ltv.customers.slice(0, 10).map((c, i) => (
                  <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="p-4">
                      <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.phone}</p>
                    </td>
                    <td className="p-4 text-right">
                      <span className={`font-bold ${c.ordersCount > 1 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500'}`}>
                        {c.ordersCount}
                      </span>
                      {c.ordersCount > 1 && <span className="ml-1 text-xs text-purple-400">↻</span>}
                    </td>
                    <td className="p-4 text-right font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(c.ltv)}
                    </td>
                    <td className="p-4 text-right text-gray-500 hidden sm:table-cell">
                      {formatCurrency(c.avgOrder)}
                    </td>
                    <td className="p-4 text-right text-gray-400 hidden md:table-cell text-xs">
                      {c.lastOrder ? formatDate(c.lastOrder) : '—'}
                    </td>
                  </tr>
                ))}
                {ltv.customers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">Нет данных</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expenses */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Расходы</h2>
            <p className="text-sm text-gray-400 mt-0.5">Итого: {formatCurrency(totalExpenses)}</p>
          </div>
          {canEdit && (
            <button onClick={() => setShowExpenseForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Добавить
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                <th className="text-left table-header p-4">Категория</th>
                <th className="text-right table-header p-4">Сумма</th>
                <th className="text-left table-header p-4 hidden sm:table-cell">Описание</th>
                <th className="text-left table-header p-4 hidden md:table-cell">Дата</th>
                {user?.role === 'ADMIN' && <th className="p-4 w-10" />}
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    <Calendar className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <p>Расходов нет за выбранный период</p>
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="p-4">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {EXPENSE_CATEGORY_LABELS[exp.category]}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                        -{formatCurrency(exp.amount)}
                      </span>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <span className="text-sm text-gray-500">{exp.description || '—'}</span>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className="text-sm text-gray-400">{formatDate(exp.date)}</span>
                    </td>
                    {user?.role === 'ADMIN' && (
                      <td className="p-4">
                        <button
                          onClick={() => setDeleteExpenseId(exp.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Form Modal */}
      <Modal open={showExpenseForm} onClose={() => setShowExpenseForm(false)} title="Добавить расход" size="sm">
        <form onSubmit={handleAddExpense} className="space-y-4">
          <div>
            <label className="label">Категория</label>
            <select
              className="input"
              value={expenseForm.category}
              onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Сумма *</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="label">Описание</label>
            <input
              className="input"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Например: Facebook Ads - Декабрь"
            />
          </div>
          <div>
            <label className="label">Дата</label>
            <input
              className="input"
              type="date"
              value={expenseForm.date}
              onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowExpenseForm(false)} className="btn-secondary flex-1 justify-center">Отмена</button>
            <button type="submit" disabled={savingExpense} className="btn-primary flex-1 justify-center">
              {savingExpense ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Добавить'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteExpenseId}
        onClose={() => setDeleteExpenseId(null)}
        onConfirm={handleDeleteExpense}
        message="Удалить запись о расходе?"
      />
    </div>
  );
}
