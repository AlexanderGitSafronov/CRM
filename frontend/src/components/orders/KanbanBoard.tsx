'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import Link from 'next/link';
import type { Order, OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Phone, User, Settings2, Check } from 'lucide-react';

// All statuses that exist in the system, in pipeline order.
const ALL_STATUSES: OrderStatus[] = [
  'NEW',
  'PROCESSING',
  'CALLED',
  'NO_ANSWER',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
];

// Core pipeline columns always offered by default.
const CORE_STATUSES: OrderStatus[] = [
  'NEW',
  'PROCESSING',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

const STORAGE_KEY = 'kanban.visibleColumns';
// Sentinel droppable id for orders whose status has no visible column.
const OTHER_COLUMN_ID = '__OTHER__';

interface KanbanBoardProps {
  orders: Order[];
  onOrderUpdate: () => void;
}

function KanbanCard({ order, isDragging }: { order: Order; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: order.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'kanban-card',
        isDragging && 'opacity-30'
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <Link
          href={`/orders/${order.id}`}
          className="text-xs font-bold text-primary-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          #{order.orderNum}
        </Link>
        <span className="text-xs text-gray-400">{formatDate(order.createdAt)}</span>
      </div>

      <div className="flex items-center gap-1.5 mb-1">
        <User className="w-3 h-3 text-gray-400 shrink-0" />
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {order.customer.name}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        <Phone className="w-3 h-3 text-gray-400 shrink-0" />
        <span className="text-xs text-gray-500">{order.customer.phone}</span>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
        {order.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
      </p>

      <div className="flex items-center justify-between">
        <span className="font-bold text-sm text-gray-900 dark:text-white">
          {formatCurrency(order.total)}
        </span>
        {order.manager && (
          <span className="text-xs text-gray-400 truncate max-w-[80px]">
            {order.manager.name.split(' ')[0]}
          </span>
        )}
      </div>
    </div>
  );
}

function DroppableColumn({
  columnId,
  label,
  badgeClass,
  orders,
  activeId,
  droppable,
}: {
  columnId: string;
  label: string;
  badgeClass: string;
  orders: Order[];
  activeId: string | null;
  droppable: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId, disabled: !droppable });

  const total = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  return (
    <div className="flex flex-col w-64 shrink-0">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
              badgeClass
            )}
          >
            {label}
          </span>
          <span className="text-xs text-gray-400 font-medium shrink-0">{orders.length}</span>
        </div>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">
          {formatCurrency(total)}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'kanban-column flex-1 rounded-lg p-2 min-h-[100px] transition-colors',
          isOver
            ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-dashed border-primary-400 kanban-column-over'
            : 'bg-gray-100/80 dark:bg-gray-800/50'
        )}
      >
        {orders.map((order) => (
          <KanbanCard
            key={order.id}
            order={order}
            isDragging={activeId === order.id}
          />
        ))}
        {orders.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-gray-400">
            Пусто
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ orders, onOrderUpdate }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Local copy of statuses so a drag can be optimistic without waiting for the
  // parent to refetch. Keyed by order id -> status. Falls back to the prop.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, OrderStatus>>({});

  // Which status columns are currently visible. Persisted in localStorage.
  const [visibleColumns, setVisibleColumns] = useState<OrderStatus[]>(CORE_STATUSES);
  const [hydrated, setHydrated] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);

  // When the parent supplies fresh orders, the override for that order is no
  // longer needed (the server value is now authoritative). Drop stale overrides.
  useEffect(() => {
    setStatusOverrides((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      let changed = false;
      const next: Record<string, OrderStatus> = {};
      for (const order of orders) {
        const override = prev[order.id];
        if (override !== undefined && order.status !== override) {
          next[order.id] = override; // server hasn't caught up yet, keep it
        } else if (override !== undefined) {
          changed = true; // server matches override -> drop it
        }
      }
      // detect removed orders too
      if (!changed && Object.keys(next).length === Object.keys(prev).length) return prev;
      return next;
    });
  }, [orders]);

  const effectiveStatus = useCallback(
    (order: Order): OrderStatus => statusOverrides[order.id] ?? order.status,
    [statusOverrides]
  );

  // Hydrate visible columns from localStorage. Default: core pipeline + any
  // status that currently has orders, so nothing important is hidden on load.
  useEffect(() => {
    let stored: OrderStatus[] | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          stored = parsed.filter((s): s is OrderStatus =>
            (ALL_STATUSES as string[]).includes(s)
          );
        }
      }
    } catch {
      stored = null;
    }

    if (stored && stored.length > 0) {
      setVisibleColumns(stored);
    } else {
      const withOrders = new Set(orders.map((o) => o.status));
      const defaults = ALL_STATUSES.filter(
        (s) => CORE_STATUSES.includes(s) || withOrders.has(s)
      );
      setVisibleColumns(defaults);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist visible columns once hydrated.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch {
      /* ignore quota / private mode */
    }
  }, [visibleColumns, hydrated]);

  // Close the config popover on outside click.
  useEffect(() => {
    if (!configOpen) return;
    const handler = (e: MouseEvent) => {
      if (configRef.current && !configRef.current.contains(e.target as Node)) {
        setConfigOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [configOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Preserve column order, keep it stable, and drop any unknown stored values.
  const orderedVisible = useMemo(
    () => ALL_STATUSES.filter((s) => visibleColumns.includes(s)),
    [visibleColumns]
  );

  const visibleSet = useMemo(() => new Set(orderedVisible), [orderedVisible]);

  // Orders whose (effective) status has no visible column — surfaced in "Інші"
  // so a drag-and-drop or status filter can never make an order vanish.
  const otherOrders = useMemo(
    () => orders.filter((o) => !visibleSet.has(effectiveStatus(o))),
    [orders, visibleSet, effectiveStatus]
  );

  const getColumnOrders = useCallback(
    (status: OrderStatus) => orders.filter((o) => effectiveStatus(o) === status),
    [orders, effectiveStatus]
  );

  const toggleColumn = (status: OrderStatus) => {
    setVisibleColumns((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveOrder(orders.find((o) => o.id === event.active.id) || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setActiveOrder(null);

    const { active, over } = event;
    if (!over) return;

    // The "Інші" column isn't a real status target.
    if (over.id === OTHER_COLUMN_ID) return;

    const orderId = active.id as string;
    const newStatus = over.id as OrderStatus;
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const previousStatus = effectiveStatus(order);
    if (previousStatus === newStatus) return;

    // 1) Optimistically move the card to the target column.
    setStatusOverrides((prev) => ({ ...prev, [orderId]: newStatus }));

    try {
      // 2) Persist on the backend.
      await api.put(`/orders/${orderId}`, { status: newStatus });
      toast.success(`Статус змінено: ${ORDER_STATUS_LABELS[newStatus]}`);
      // 3) Resync counts / data from the parent. The override is cleared once
      //    the refetched order matches (see the orders effect above).
      onOrderUpdate();
    } catch {
      // Roll back to the original column.
      setStatusOverrides((prev) => {
        const next = { ...prev };
        if (order.status === previousStatus) {
          delete next[orderId];
        } else {
          next[orderId] = previousStatus;
        }
        return next;
      });
      toast.error('Помилка при зміні статусу');
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex items-center justify-end mb-3">
        <div className="relative" ref={configRef}>
          <button
            type="button"
            onClick={() => setConfigOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Налаштувати колонки
          </button>

          {configOpen && (
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-2">
              <p className="px-2 pt-1 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Видимі статуси
              </p>
              <div className="max-h-72 overflow-y-auto">
                {ALL_STATUSES.map((status) => {
                  const checked = visibleSet.has(status);
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => toggleColumn(status)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                    >
                      <span
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                          checked
                            ? 'bg-primary-600 border-primary-600 text-white'
                            : 'border-gray-300 dark:border-gray-600'
                        )}
                      >
                        {checked && <Check className="w-3 h-3" />}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                          ORDER_STATUS_COLORS[status]
                        )}
                      >
                        {ORDER_STATUS_LABELS[status]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {orderedVisible.map((status) => (
          <DroppableColumn
            key={status}
            columnId={status}
            label={ORDER_STATUS_LABELS[status]}
            badgeClass={ORDER_STATUS_COLORS[status]}
            orders={getColumnOrders(status)}
            activeId={activeId}
            droppable
          />
        ))}

        {/* Catch-all so orders with a hidden status are never lost. */}
        {otherOrders.length > 0 && (
          <DroppableColumn
            columnId={OTHER_COLUMN_ID}
            label="Інші"
            badgeClass="bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
            orders={otherOrders}
            activeId={activeId}
            droppable={false}
          />
        )}
      </div>

      <DragOverlay>
        {activeOrder && (
          <div className="kanban-card w-64 shadow-xl rotate-2 opacity-95">
            <div className="text-xs font-bold text-primary-600 mb-1">#{activeOrder.orderNum}</div>
            <p className="text-sm font-medium">{activeOrder.customer.name}</p>
            <p className="text-xs text-gray-500">{activeOrder.customer.phone}</p>
            <p className="font-bold text-sm mt-1">{formatCurrency(activeOrder.total)}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
