'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  DollarSign,
  CheckCircle,
  TrendingUp,
  Wallet,
  Plus,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Payment {
  id: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

interface OperatorPayroll {
  operatorId: string;
  name: string;
  confirmedOrders: number;
  confirmedBonus: number;
  upsellAmount: number;
  upsellBonus: number;
  totalEarned: number;
  totalPaid: number;
  balance: number;
  payments: Payment[];
}

interface PayrollData {
  operators: OperatorPayroll[];
  rates: { confirmRate: number; upsellRate: number };
}

const PERIODS = [
  { label: 'Цей місяць', value: 'month' },
  { label: '7 днів', value: '7' },
  { label: '30 днів', value: '30' },
  { label: 'Весь час', value: 'all' },
];

function getPeriodDates(period: string): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  if (period === 'all') return {};
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: from.toISOString().split('T')[0] };
  }
  const days = parseInt(period);
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { dateFrom: from.toISOString().split('T')[0] };
}

function fmt(n: number) {
  return n.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function CcPayrollPage() {
  const [data, setData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [expandedOp, setExpandedOp] = useState<string | null>(null);

  // Pay modal state
  const [payModal, setPayModal] = useState<{ operatorId: string; name: string; balance: number } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = getPeriodDates(period);
      const res = await api.get('/analytics/cc-payroll', { params });
      setData(res.data);
    } catch {
      toast.error('Помилка завантаження');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModal) return;
    setSaving(true);
    try {
      await api.post('/analytics/cc-payroll', {
        operatorId: payModal.operatorId,
        amount: parseFloat(payAmount),
        note: payNote || undefined,
      });
      toast.success(`Виплату ${fmt(parseFloat(payAmount))} грн зафіксовано`);
      setPayModal(null);
      setPayAmount('');
      setPayNote('');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Помилка';
      toast.error(msg);
    }
    setSaving(false);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Скасувати цю виплату?')) return;
    try {
      await api.delete(`/analytics/cc-payroll/${paymentId}`);
      toast.success('Виплату скасовано');
      fetchData();
    } catch {
      toast.error('Помилка');
    }
  };

  const totalEarned = data?.operators.reduce((s, o) => s + o.totalEarned, 0) ?? 0;
  const totalPaid = data?.operators.reduce((s, o) => s + o.totalPaid, 0) ?? 0;
  const totalBalance = data?.operators.reduce((s, o) => s + o.balance, 0) ?? 0;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Зарплата КЦ</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data ? `${data.rates.confirmRate} грн/підтв. · ${(data.rates.upsellRate * 100).toFixed(0)}% від допродажу` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  period === p.value
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Нараховано</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(totalEarned)} ₴</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Виплачено</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(totalPaid)} ₴</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
              totalBalance > 0
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-400'
            )}>
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">До виплати</p>
              <p className={cn('text-xl font-bold', totalBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white')}>
                {fmt(totalBalance)} ₴
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : !data || data.operators.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">Немає даних за цей період</div>
      ) : (
        <div className="space-y-3">
          {data.operators.map((op) => (
            <div key={op.operatorId} className="card overflow-hidden">
              {/* Operator row */}
              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                  <span className="font-semibold text-purple-700 dark:text-purple-400">
                    {op.name[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">{op.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                      {op.confirmedOrders} підтв. × {data.rates.confirmRate} = <b className="text-gray-700 dark:text-gray-200">{fmt(op.confirmedBonus)} ₴</b>
                    </span>
                    {op.upsellAmount > 0 && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-blue-500" />
                        Допродаж {fmt(op.upsellAmount)} ₴ × 20% = <b className="text-gray-700 dark:text-gray-200">{fmt(op.upsellBonus)} ₴</b>
                      </span>
                    )}
                  </div>
                </div>

                {/* Numbers */}
                <div className="hidden sm:flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Нараховано</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{fmt(op.totalEarned)} ₴</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Виплачено</p>
                    <p className="font-medium text-blue-600 dark:text-blue-400">{fmt(op.totalPaid)} ₴</p>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <p className="text-xs text-gray-400">До виплати</p>
                    <p className={cn('font-bold text-base', op.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400')}>
                      {fmt(op.balance)} ₴
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {op.balance > 0 && (
                    <button
                      onClick={() => {
                        setPayModal({ operatorId: op.operatorId, name: op.name, balance: op.balance });
                        setPayAmount(String(op.balance));
                        setPayNote('');
                      }}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Виплатити
                    </button>
                  )}
                  {op.payments.length > 0 && (
                    <button
                      onClick={() => setExpandedOp(expandedOp === op.operatorId ? null : op.operatorId)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      {expandedOp === op.operatorId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile numbers */}
              <div className="sm:hidden flex items-center gap-4 px-4 pb-3 text-sm border-t border-gray-50 dark:border-gray-800/50 pt-3">
                <div>
                  <p className="text-xs text-gray-400">Нараховано</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{fmt(op.totalEarned)} ₴</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Виплачено</p>
                  <p className="font-medium text-blue-600 dark:text-blue-400">{fmt(op.totalPaid)} ₴</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">До виплати</p>
                  <p className={cn('font-bold', op.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400')}>
                    {fmt(op.balance)} ₴
                  </p>
                </div>
              </div>

              {/* Payment history */}
              {expandedOp === op.operatorId && op.payments.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                  <p className="text-xs text-gray-400 px-4 pt-3 pb-1 font-medium uppercase tracking-wide">Історія виплат</p>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
                    {op.payments.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(p.amount)} ₴</span>
                          {p.note && <span className="text-xs text-gray-400 ml-2">{p.note}</span>}
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(p.createdAt).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </span>
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          className="p-1 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                          title="Скасувати виплату"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pay modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">Зафіксувати виплату</h2>
              <button
                onClick={() => setPayModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >✕</button>
            </div>
            <form onSubmit={handlePay} className="p-5 space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Оператор: <span className="font-semibold text-gray-900 dark:text-white">{payModal.name}</span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Борг: <span className="font-bold text-amber-600 dark:text-amber-400">{fmt(payModal.balance)} ₴</span>
              </div>
              <div>
                <label className="label">Сума виплати (грн) *</label>
                <input
                  className="input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Примітка</label>
                <input
                  className="input"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Готівка, карта, тощо"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setPayModal(null)} className="btn-secondary flex-1 justify-center">
                  Скасувати
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : (
                    <><Plus className="w-4 h-4" />Зберегти</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
