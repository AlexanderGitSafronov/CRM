'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Phone, CheckCircle, XCircle, PhoneMissed, Clock, AlertCircle, BarChart2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TodayStats {
  orders: number;
  called: number;
  confirmed: number;
  cancelled: number;
  noAnswer: number;
  confirmRate: number | null;
}

interface OperatorStat {
  operatorId: string;
  name: string;
  total: number;
  called: number;
  confirmed: number;
  cancelled: number;
  noAnswer: number;
  confirmRate: number | null;
}

interface CancelReason {
  reason: string;
  count: number;
}

interface CcStatsData {
  today: TodayStats;
  period: TodayStats;
  pendingCallbacks: number;
  overdueCallbacks: number;
  operators: OperatorStat[];
  topCancelReasons: CancelReason[];
}

const PERIODS = [
  { label: 'Сьогодні', value: '0' },
  { label: '7 днів', value: '7' },
  { label: '14 днів', value: '14' },
  { label: '30 днів', value: '30' },
];

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function CcStatsPage() {
  const [data, setData] = useState<CcStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (period !== '0') {
        const from = new Date();
        from.setDate(from.getDate() - parseInt(period));
        params.dateFrom = from.toISOString().split('T')[0];
      }
      const res = await api.get('/analytics/cc-stats', { params });
      setData(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, [period]);

  const stats = period === '0' ? data?.today : data?.period;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Статистика КЦ</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Аналітика роботи оператора</p>
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
            onClick={fetchStats}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Callbacks alert */}
      {data && data.overdueCallbacks > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              Прострочені передзвони: {data.overdueCallbacks}
            </p>
            <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">
              Потрібно зателефонувати якнайшвидше
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : !data || !stats ? (
        <div className="card p-12 text-center text-gray-400">Немає даних</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard
              icon={Phone}
              label="Всього заявок"
              value={stats.orders}
              color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
            />
            <StatCard
              icon={CheckCircle}
              label="Підтверджено"
              value={stats.confirmed}
              sub={stats.confirmRate !== null ? `${stats.confirmRate}% конверсія` : undefined}
              color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              icon={XCircle}
              label="Відмов"
              value={stats.cancelled}
              sub={stats.called > 0 ? `${Math.round((stats.cancelled / stats.called) * 100)}% від прозвонених` : undefined}
              color="bg-red-50 dark:bg-red-900/20 text-red-500"
            />
            <StatCard
              icon={PhoneMissed}
              label="Недозвон"
              value={stats.noAnswer}
              color="bg-amber-50 dark:bg-amber-900/20 text-amber-500"
            />
            <StatCard
              icon={Phone}
              label="Прозвонено"
              value={stats.called}
              sub={stats.orders > 0 ? `${Math.round((stats.called / stats.orders) * 100)}% від заявок` : undefined}
              color="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
            />
            <StatCard
              icon={Clock}
              label="Передзвони"
              value={data.pendingCallbacks}
              sub={data.overdueCallbacks > 0 ? `${data.overdueCallbacks} прострочено` : 'Все вчасно'}
              color={data.overdueCallbacks > 0
                ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
                : 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'}
            />
          </div>

          {/* Conversion bar */}
          {stats.confirmRate !== null && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 dark:text-white">% Підтверджень</h2>
                <span className={cn(
                  'text-2xl font-bold',
                  stats.confirmRate >= 60 ? 'text-emerald-600 dark:text-emerald-400'
                    : stats.confirmRate >= 35 ? 'text-amber-500'
                    : 'text-red-500'
                )}>
                  {stats.confirmRate}%
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    stats.confirmRate >= 60 ? 'bg-emerald-500'
                      : stats.confirmRate >= 35 ? 'bg-amber-400'
                      : 'bg-red-500'
                  )}
                  style={{ width: `${Math.min(100, stats.confirmRate)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>Підтверджено: {stats.confirmed}</span>
                <span>Відмов: {stats.cancelled}</span>
              </div>
            </div>
          )}

          {/* Per-operator table */}
          {data.operators.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 p-5 border-b border-gray-100 dark:border-gray-800">
                <BarChart2 className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">По операторах</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                      <th className="text-left table-header p-4">Оператор</th>
                      <th className="text-right table-header p-4">Заявок</th>
                      <th className="text-right table-header p-4">Підтв.</th>
                      <th className="text-right table-header p-4 hidden sm:table-cell">Відмов</th>
                      <th className="text-right table-header p-4 hidden sm:table-cell">Недозвон</th>
                      <th className="text-right table-header p-4">% Підтв.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.operators.map((op) => {
                      const color =
                        op.confirmRate === null ? 'text-gray-400'
                          : op.confirmRate >= 60 ? 'text-emerald-600 dark:text-emerald-400'
                          : op.confirmRate >= 35 ? 'text-amber-500'
                          : 'text-red-500';
                      return (
                        <tr key={op.operatorId} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="p-4 font-medium text-gray-900 dark:text-white">{op.name}</td>
                          <td className="p-4 text-right text-gray-600 dark:text-gray-300">{op.total}</td>
                          <td className="p-4 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{op.confirmed}</td>
                          <td className="p-4 text-right text-red-500 hidden sm:table-cell">{op.cancelled}</td>
                          <td className="p-4 text-right text-amber-500 hidden sm:table-cell">{op.noAnswer}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden hidden lg:block">
                                <div
                                  className={cn(
                                    'h-full rounded-full',
                                    (op.confirmRate ?? 0) >= 60 ? 'bg-emerald-500'
                                      : (op.confirmRate ?? 0) >= 35 ? 'bg-amber-400'
                                      : 'bg-red-500'
                                  )}
                                  style={{ width: `${Math.min(100, op.confirmRate ?? 0)}%` }}
                                />
                              </div>
                              <span className={cn('font-bold', color)}>
                                {op.confirmRate !== null ? `${op.confirmRate}%` : '—'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top cancel reasons */}
          {data.topCancelReasons.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="w-4 h-4 text-red-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Топ причин відмов</h2>
                <span className="text-xs text-gray-400 ml-1">всього: {stats.cancelled}</span>
              </div>
              <div className="space-y-2.5">
                {data.topCancelReasons.map((r, i) => {
                  const pct = stats.cancelled > 0 ? Math.round((r.count / stats.cancelled) * 100) : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[70%]">{r.reason}</span>
                        <span className="text-gray-500 flex-shrink-0 ml-2">{r.count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
