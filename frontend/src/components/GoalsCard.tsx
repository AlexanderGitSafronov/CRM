'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Target, TrendingUp, ShoppingCart, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Goal {
  id: string;
  period: 'MONTH' | 'QUARTER' | 'YEAR';
  startDate: string;
  endDate: string;
  targetRevenue: number;
  targetOrders: number;
  active: boolean;
  progress: {
    revenue: number;
    orders: number;
    revenuePct: number;
    ordersPct: number;
    elapsedPct: number;
    daysLeft: number;
  };
}

const PERIOD_LABEL: Record<Goal['period'], string> = {
  MONTH: 'Місяць',
  QUARTER: 'Квартал',
  YEAR: 'Рік',
};

export default function GoalsCard() {
  const [goals, setGoals] = useState<Goal[] | null>(null);

  useEffect(() => {
    api.get('/goals', { params: { active: true } })
      .then((r) => setGoals(r.data))
      .catch(() => setGoals([]));
  }, []);

  if (!goals) return null;

  if (goals.length === 0) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Цілі продажів</h3>
              <p className="text-xs text-gray-500">Поставте план на місяць — і слідкуйте за прогресом</p>
            </div>
          </div>
          <Link href="/goals" className="btn-secondary text-sm">
            Налаштувати
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Цілі продажів</h3>
            <p className="text-xs text-gray-500">Активних: {goals.length}</p>
          </div>
        </div>
        <Link href="/goals" className="text-sm text-primary-600 hover:underline">
          Усі цілі →
        </Link>
      </div>

      <div className="space-y-4">
        {goals.map((g) => <GoalRow key={g.id} goal={g} />)}
      </div>
    </div>
  );
}

function GoalRow({ goal }: { goal: Goal }) {
  const { progress, period, targetRevenue, targetOrders, daysLeft } = {
    progress: goal.progress,
    period: goal.period,
    targetRevenue: goal.targetRevenue,
    targetOrders: goal.targetOrders,
    daysLeft: goal.progress.daysLeft,
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-800/30">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white">
            {PERIOD_LABEL[period]}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(goal.startDate).toLocaleDateString('uk-UA')} — {new Date(goal.endDate).toLocaleDateString('uk-UA')}
          </span>
        </div>
        <span className={`text-xs font-medium ${daysLeft <= 3 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'}`}>
          {daysLeft > 0 ? `Залишилось: ${daysLeft} дн` : 'Завершено'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {targetRevenue > 0 && (
          <ProgressMetric
            icon={TrendingUp}
            label="Виручка"
            current={progress.revenue}
            target={targetRevenue}
            pct={progress.revenuePct}
            elapsedPct={progress.elapsedPct}
            format={formatCurrency}
            tone="emerald"
          />
        )}
        {targetOrders > 0 && (
          <ProgressMetric
            icon={ShoppingCart}
            label="Замовлень"
            current={progress.orders}
            target={targetOrders}
            pct={progress.ordersPct}
            elapsedPct={progress.elapsedPct}
            format={(n) => n.toLocaleString('uk-UA')}
            tone="blue"
          />
        )}
      </div>
    </div>
  );
}

function ProgressMetric({
  icon: Icon, label, current, target, pct, elapsedPct, format, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  current: number;
  target: number;
  pct: number;
  elapsedPct: number;
  format: (n: number) => string;
  tone: 'emerald' | 'blue';
}) {
  // Color: ahead of pace -> emerald, behind -> rose, on-pace -> primary
  const ahead = pct >= elapsedPct;
  const completed = pct >= 100;
  const barClass = completed
    ? 'bg-gradient-to-r from-emerald-400 to-green-500'
    : ahead
      ? (tone === 'emerald'
          ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
          : 'bg-gradient-to-r from-blue-400 to-indigo-500')
      : 'bg-gradient-to-r from-amber-400 to-rose-500';

  const display = Math.min(100, Math.max(0, pct));

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">{label}</span>
        </div>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{pct}%</span>
      </div>
      <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
        {format(current)}
        <span className="text-xs font-normal text-gray-400 ml-1">/ {format(target)}</span>
      </div>
      <div className="relative h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${barClass} transition-all duration-700 ease-out`}
          style={{ width: `${display}%` }}
        />
        {/* Pace indicator */}
        {elapsedPct > 0 && elapsedPct < 100 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-700 dark:bg-gray-300 opacity-50"
            style={{ left: `${elapsedPct}%` }}
            title={`Очікуваний темп: ${elapsedPct}%`}
          />
        )}
      </div>
      <p className="text-[10px] text-gray-400 mt-1">
        {ahead ? '✓ випереджаєте план' : `відставання ${elapsedPct - pct}% від темпу`}
      </p>
    </div>
  );
}
