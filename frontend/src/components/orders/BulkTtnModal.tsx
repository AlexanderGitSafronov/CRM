'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Truck, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Order } from '@/types';

interface BulkTtnRow {
  orderId: string;
  weight: string;
  description: string;
}

type RowResult = 'success' | { error: string };

interface Props {
  open: boolean;
  onClose: () => void;
  orders: Order[];
  onDone: () => void;
}

export default function BulkTtnModal({ open, onClose, orders, onDone }: Props) {
  // Snapshot the selection at open time so a background list refresh (onDone -> fetchOrders)
  // can't reshuffle rows or wipe the per-order success/error indicators.
  const [snapshot, setSnapshot] = useState<Order[]>([]);
  const [rows, setRows] = useState<Record<string, BulkTtnRow>>({});
  const [results, setResults] = useState<Record<string, RowResult>>({});
  const [loading, setLoading] = useState(false);

  // Initialise editable rows only when the modal opens (not on every orders prop change)
  useEffect(() => {
    if (!open) return;
    setSnapshot(orders);
    const next: Record<string, BulkTtnRow> = {};
    orders.forEach((o) => {
      next[o.id] = { orderId: o.id, weight: '1', description: 'Товар' };
    });
    setRows(next);
    setResults({});
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateRow = (id: string, field: 'weight' | 'description', value: string) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleCreate = async () => {
    if (!snapshot.length) return;
    setLoading(true);
    try {
      const items = snapshot.map((o) => {
        const r = rows[o.id];
        const w = parseFloat(r?.weight ?? '1');
        return {
          orderId: o.id,
          weight: Number.isFinite(w) && w > 0 ? w : 1,
          description: (r?.description ?? '').trim() || 'Товар',
        };
      });
      const res = await api.post('/nova-poshta/bulk-create-ttn', { items });
      const data = res.data as {
        success?: number;
        failed?: number;
        results?: { orderId: string; ttn?: string; error?: string }[];
      };

      // Map per-order results if the API returns them, otherwise fall back to counts
      const nextResults: Record<string, RowResult> = {};
      if (Array.isArray(data.results)) {
        data.results.forEach((r) => {
          nextResults[r.orderId] = r.ttn ? 'success' : { error: r.error || 'Помилка' };
        });
        // Any selected order without an explicit result is treated as success
        snapshot.forEach((o) => {
          if (!nextResults[o.id]) nextResults[o.id] = 'success';
        });
      } else {
        snapshot.forEach((o) => { nextResults[o.id] = 'success'; });
      }
      setResults(nextResults);

      const failed = Object.values(nextResults).filter((r) => r !== 'success').length;
      const success = snapshot.length - failed;
      if (failed) {
        toast.error(`ТТН: ${success} створено, ${failed} помилок`);
      } else {
        toast.success(`ТТН створено: ${success}`);
      }
      onDone();
      // Auto-close only when everything succeeded
      if (!failed) onClose();
    } catch {
      toast.error('Помилка масового TTN');
    }
    setLoading(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Створення ТТН" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Вкажіть вагу (кг) та опис для кожного замовлення. Буде створено окрему ТТН на кожен рядок.
        </p>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                <th className="table-header p-2">№</th>
                <th className="table-header p-2">Клієнт</th>
                <th className="table-header p-2 hidden sm:table-cell">Сума</th>
                <th className="table-header p-2 w-24">Вага, кг</th>
                <th className="table-header p-2">Опис</th>
                <th className="table-header p-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {snapshot.map((o) => {
                const r = rows[o.id];
                const result = results[o.id];
                return (
                  <tr
                    key={o.id}
                    className="border-b border-gray-50 dark:border-gray-800/50"
                  >
                    <td className="p-2 font-semibold text-primary-600 whitespace-nowrap">
                      #{o.orderNum}
                    </td>
                    <td className="p-2">
                      <div className="max-w-[140px]">
                        <p className="truncate text-gray-900 dark:text-white">{o.customer.name}</p>
                        <p className="text-xs text-gray-400">{o.customer.phone}</p>
                      </div>
                    </td>
                    <td className="p-2 hidden sm:table-cell whitespace-nowrap text-gray-600 dark:text-gray-400">
                      {formatCurrency(o.total)}
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        className="input py-1.5"
                        value={r?.weight ?? '1'}
                        onChange={(e) => updateRow(o.id, 'weight', e.target.value)}
                        disabled={loading || result === 'success'}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        className="input py-1.5"
                        value={r?.description ?? 'Товар'}
                        onChange={(e) => updateRow(o.id, 'description', e.target.value)}
                        disabled={loading || result === 'success'}
                      />
                    </td>
                    <td className="p-2">
                      {result === 'success' ? (
                        <span title="ТТН створено">
                          <Check className="w-4 h-4 text-green-600" />
                        </span>
                      ) : result ? (
                        <span title={result.error}>
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {Object.values(results).some((r) => r !== 'success') && (
          <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-700 dark:text-rose-400 space-y-1">
            {snapshot
              .filter((o) => results[o.id] && results[o.id] !== 'success')
              .map((o) => (
                <p key={o.id}>
                  #{o.orderNum}: {(results[o.id] as { error: string }).error}
                </p>
              ))}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary justify-center">
            Закрити
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !snapshot.length}
            className="btn-primary justify-center text-orange-50 bg-orange-600 hover:bg-orange-700 border-orange-600"
          >
            <Truck className="w-4 h-4" />
            {loading ? 'Створення...' : `Створити ТТН (${snapshot.length})`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
