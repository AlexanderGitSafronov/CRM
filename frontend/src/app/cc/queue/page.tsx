'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Phone, ChevronRight, RefreshCw, ListChecks, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type QueueReason = 'callback' | 'sla' | 'noanswer';

interface QueueItem {
  id: string;
  orderNum: number;
  customerName: string;
  phone: string;
  status: string;
  reason: QueueReason;
  scheduledAt: string | null;
}

const REASON_META: Record<QueueReason, { label: string; badge: string }> = {
  callback: {
    label: 'Перезвон',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  sla: {
    label: 'SLA',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  noanswer: {
    label: 'Недозвон',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
};

export default function CcQueuePage() {
  const router = useRouter();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/orders/queue');
      setItems(res.data.items ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time: refresh queue silently when a status changes or new order arrives
  useEffect(() => {
    const onChange = () => load(true);
    window.addEventListener('cc:status_changed', onChange);
    window.addEventListener('cc:new_order', onChange);
    return () => {
      window.removeEventListener('cc:status_changed', onChange);
      window.removeEventListener('cc:new_order', onChange);
    };
  }, [load]);

  return (
    <div className="space-y-4">
      {/* Title + refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Черга</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{items.length} потребують уваги</p>
        </div>
        <button
          onClick={() => load()}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Queue list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <ListChecks className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Черга порожня 🎉</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const meta = REASON_META[item.reason];
            return (
              <button
                key={item.id}
                onClick={() => router.push(`/cc/orders/${item.id}?from=queue`)}
                className="card w-full flex items-center gap-4 p-4 text-left hover:shadow-md transition-shadow group"
              >
                {/* Order number */}
                <div className="shrink-0 w-14 text-center">
                  <p className="text-xs text-gray-400">№</p>
                  <p className="font-bold text-gray-900 dark:text-white">#{item.orderNum}</p>
                </div>

                <div className="w-px h-10 bg-gray-100 dark:bg-gray-700 shrink-0" />

                {/* Customer */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{item.customerName}</p>
                  <a
                    href={`tel:${item.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 inline-flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    {item.phone}
                  </a>
                </div>

                {/* Reason badge + scheduledAt */}
                <div className="shrink-0 text-right space-y-1">
                  <span className={cn('inline-block px-2.5 py-1 rounded-full text-xs font-semibold', meta.badge)}>
                    {meta.label}
                  </span>
                  {item.reason === 'callback' && item.scheduledAt && (
                    <div className="flex items-center justify-end gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {new Date(item.scheduledAt).toLocaleString('uk-UA', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 group-hover:text-gray-500 transition-colors" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
