'use client';

import Link from 'next/link';
import { ShoppingCart, Phone, MessageSquare, ShieldAlert, Star } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Order } from '@/types';
import { ORDER_SOURCE_LABELS } from '@/types';

interface Props {
  orders: Array<Order & { items: Array<{ name: string; quantity: number; price: number }> }>;
  notes?: string | null;
  isBlacklisted?: boolean;
  blacklistReason?: string | null;
}

export default function CustomerTimeline({ orders, notes, isBlacklisted, blacklistReason }: Props) {
  // Build events: order created + customer note + blacklist marker
  type Event = {
    id: string;
    when: Date;
    kind: 'order' | 'note' | 'blacklist';
    payload: unknown;
  };

  const events: Event[] = [];

  if (isBlacklisted) {
    events.push({ id: 'blacklist', when: new Date(), kind: 'blacklist', payload: blacklistReason });
  }

  if (notes) {
    events.push({ id: 'notes', when: new Date(), kind: 'note', payload: notes });
  }

  orders.forEach((o) => {
    events.push({ id: o.id, when: new Date(o.createdAt), kind: 'order', payload: o });
  });

  events.sort((a, b) => b.when.getTime() - a.when.getTime());

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Поки що немає історії</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-5 top-3 bottom-3 w-px bg-gradient-to-b from-gray-200 via-gray-200 to-transparent dark:from-gray-700 dark:via-gray-700" />
      <div className="space-y-5">
        {events.map((ev) => (
          <TimelineItem key={ev.id} event={ev} />
        ))}
      </div>
    </div>
  );
}

function TimelineItem({ event }: { event: { kind: string; when: Date; payload: unknown } }) {
  if (event.kind === 'blacklist') {
    return (
      <div className="relative pl-12">
        <Dot tone="rose" icon={ShieldAlert} />
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3">
          <p className="text-sm font-medium text-rose-700 dark:text-rose-400">У чорному списку</p>
          {(event.payload as string) && (
            <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">{event.payload as string}</p>
          )}
        </div>
      </div>
    );
  }

  if (event.kind === 'note') {
    return (
      <div className="relative pl-12">
        <Dot tone="amber" icon={MessageSquare} />
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Замітка</p>
          <p className="text-sm text-amber-700 dark:text-amber-400 whitespace-pre-line">{event.payload as string}</p>
        </div>
      </div>
    );
  }

  const o = event.payload as Order & { items: Array<{ name: string; quantity: number; price: number }> };
  const totalItems = o.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;

  return (
    <div className="relative pl-12">
      <Dot tone={o.status === 'DELIVERED' ? 'emerald' : o.status === 'CANCELLED' ? 'rose' : 'blue'} icon={ShoppingCart} />
      <Link
        href={`/orders/${o.id}`}
        className="block rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/40 p-3 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all"
      >
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-white">#{o.orderNum}</span>
            <StatusBadge status={o.status} />
            {o.source && <span className="text-xs text-gray-400">{ORDER_SOURCE_LABELS[o.source] || o.source}</span>}
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(o.total)}</span>
        </div>
        {o.items?.length > 0 && (
          <p className="text-xs text-gray-500 truncate">
            {o.items.slice(0, 3).map((i) => `${i.name} ×${i.quantity}`).join(', ')}
            {o.items.length > 3 && ` … та ще ${o.items.length - 3}`}
            {' · '}
            <span className="text-gray-400">{totalItems} шт</span>
          </p>
        )}
        <p className="text-[11px] text-gray-400 mt-1">{formatDateTime(o.createdAt)}</p>
      </Link>
    </div>
  );
}

function Dot({
  tone, icon: Icon,
}: { tone: 'rose' | 'amber' | 'emerald' | 'blue'; icon: React.ComponentType<{ className?: string }> }) {
  const cls: Record<string, string> = {
    rose: 'bg-rose-100 text-rose-600 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:ring-rose-900/50',
    amber: 'bg-amber-100 text-amber-600 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-900/50',
    emerald: 'bg-emerald-100 text-emerald-600 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-900/50',
    blue: 'bg-blue-100 text-blue-600 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-900/50',
  };
  return (
    <div className={`absolute left-3 w-5 h-5 rounded-full ring-4 ring-white dark:ring-gray-900 flex items-center justify-center ${cls[tone]}`}>
      <Icon className="w-2.5 h-2.5" />
    </div>
  );
}
