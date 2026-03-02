'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
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
interface ProductData { name: string; revenue: number; quantity: number }

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [summary, setSummary] = useState({ revenue: 0, orders: 0, profit: 0 });
  const [loading, setLoading] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    category: 'ADVERTISING',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [savingExpense, setSavingExpense] = useState(false);

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
    const params = buildDateParams();
    try {
      const [dayRes, managerRes, productRes, expenseRes, summaryRes] = await Promise.all([
        api.get('/analytics/orders-by-day', { params: { days: period } }),
        api.get('/analytics/revenue-by-manager', { params }),
        api.get('/analytics/revenue-by-product', { params: { ...params, limit: 8 } }),
        api.get('/analytics/expenses', { params: { ...params, limit: 100 } }),
        api.get('/analytics/summary', { params }),
      ]);
      setByDay(dayRes.data);
      setByManager(managerRes.data);
      setByProduct(productRes.data);
      setExpenses(expenseRes.data.expenses);
      setTotalExpenses(expenseRes.data.total);
      const s = summaryRes.data;
      setSummary({ revenue: s.revenue, orders: s.orders.total, profit: s.profit });
    } catch {}
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
        </div>
      </div>

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

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Динамика выручки</h2>
          {loading ? (
            <div className="h-[250px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
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
            <div className="h-[250px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
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
            <div className="h-[200px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
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

        {/* By product */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Топ товаров</h2>
          </div>
          {loading ? (
            <div className="h-[200px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
          ) : byProduct.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Нет данных</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byProduct} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), 'Выручка']} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

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
