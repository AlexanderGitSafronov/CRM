'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Sparkles, Users, ShoppingCart, Package, Zap } from 'lucide-react';

interface OrgInfo {
  id: string;
  name: string;
  plan: 'FREE' | 'PRO' | 'BUSINESS';
  maxUsers: number;
  maxOrders: number;
  maxProducts: number;
  usage: { users: number; products: number; ordersThisMonth: number };
}

const PLAN_LABEL: Record<string, string> = { FREE: 'Free', PRO: 'Pro', BUSINESS: 'Business' };

export default function PlanUsage({ compact = false }: { compact?: boolean }) {
  const [info, setInfo] = useState<OrgInfo | null>(null);

  useEffect(() => {
    api.get('/organization').then((r) => setInfo(r.data)).catch(() => {});
  }, []);

  if (!info) return null;

  const items = [
    { icon: Users, label: 'Користувачів', used: info.usage.users, max: info.maxUsers, color: 'blue' },
    { icon: ShoppingCart, label: 'Замовлень / місяць', used: info.usage.ordersThisMonth, max: info.maxOrders, color: 'violet' },
    { icon: Package, label: 'Товарів', used: info.usage.products, max: info.maxProducts, color: 'amber' },
  ];

  if (compact) {
    return (
      <div className="flex flex-wrap gap-3">
        {items.map((it) => <ProgressPill key={it.label} {...it} />)}
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-fuchsia-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{info.name}</h3>
            <p className="text-xs text-gray-500">Тариф: <span className="font-medium">{PLAN_LABEL[info.plan]}</span></p>
          </div>
        </div>
        {info.plan === 'FREE' && (
          <a
            href="mailto:sales@crm.com?subject=Хочу%20оновити%20тариф"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-blue-600 to-fuchsia-600 text-white hover:opacity-90 transition-opacity"
          >
            <Zap className="w-3.5 h-3.5" /> Оновити
          </a>
        )}
      </div>

      <div className="space-y-3">
        {items.map((it) => <ProgressBar key={it.label} {...it} />)}
      </div>
    </div>
  );
}

function pct(used: number, max: number): number {
  return Math.min(100, Math.round((used / Math.max(max, 1)) * 100));
}

function tone(p: number): { bar: string; text: string } {
  if (p >= 90) return { bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' };
  if (p >= 70) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' };
  return { bar: 'bg-gradient-to-r from-blue-500 to-violet-500', text: 'text-gray-700 dark:text-gray-300' };
}

function ProgressBar({
  icon: Icon, label, used, max,
}: { icon: React.ComponentType<{ className?: string }>; label: string; used: number; max: number; color: string }) {
  const p = pct(used, max);
  const t = tone(p);
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs text-gray-500 flex-1">{label}</span>
        <span className={`text-xs font-medium ${t.text}`}>
          {used.toLocaleString('uk-UA')} / {max.toLocaleString('uk-UA')}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${t.bar} transition-all duration-700 ease-out`}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

function ProgressPill({
  icon: Icon, label, used, max,
}: { icon: React.ComponentType<{ className?: string }>; label: string; used: number; max: number; color: string }) {
  const p = pct(used, max);
  const t = tone(p);
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
      <Icon className="w-3.5 h-3.5 text-gray-400" />
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium ${t.text}`}>{used}/{max}</span>
    </div>
  );
}
