'use client';

import { useState, useCallback } from 'react';
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
import { Phone, User, Clock } from 'lucide-react';

const COLUMNS: OrderStatus[] = [
  'NEW', 'PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED',
];

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
  status,
  orders,
  activeId,
}: {
  status: OrderStatus;
  orders: Order[];
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col w-64 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              ORDER_STATUS_COLORS[status]
            )}
          >
            {ORDER_STATUS_LABELS[status]}
          </span>
          <span className="text-xs text-gray-400 font-medium">{orders.length}</span>
        </div>
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const getColumnOrders = useCallback(
    (status: OrderStatus) => orders.filter((o) => o.status === status),
    [orders]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveOrder(orders.find((o) => o.id === event.active.id) || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setActiveOrder(null);

    const { active, over } = event;
    if (!over) return;

    const orderId = active.id as string;
    const newStatus = over.id as OrderStatus;
    const order = orders.find((o) => o.id === orderId);

    if (!order || order.status === newStatus) return;

    try {
      await api.put(`/orders/${orderId}`, { status: newStatus });
      toast.success(`Статус изменён: ${ORDER_STATUS_LABELS[newStatus]}`);
      onOrderUpdate();
    } catch {
      toast.error('Ошибка при изменении статуса');
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((status) => (
          <DroppableColumn
            key={status}
            status={status}
            orders={getColumnOrders(status)}
            activeId={activeId}
          />
        ))}
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
