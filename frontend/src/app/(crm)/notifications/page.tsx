'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatRelative } from '@/lib/utils';
import Pagination from '@/components/ui/Pagination';
import type { Notification, Pagination as PaginationType } from '@/types';
import toast from 'react-hot-toast';
import { Bell, BellOff, CheckCheck, Trash2, ShoppingCart, Clock, RefreshCw } from 'lucide-react';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  NEW_ORDER: ShoppingCart,
  STATUS_CHANGE: RefreshCw,
  OVERDUE: Clock,
  REMINDER: Bell,
};

const TYPE_COLORS: Record<string, string> = {
  NEW_ORDER: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
  STATUS_CHANGE: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
  OVERDUE: 'text-red-500 bg-red-50 dark:bg-red-900/20',
  REMINDER: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({ total: 0, page: 1, limit: 20, pages: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications', {
        params: { page, limit: 20, ...(unreadOnly && { unreadOnly: true }) },
      });
      setNotifications(res.data.notifications);
      setPagination(res.data.pagination);
      setUnreadCount(res.data.unreadCount);
    } catch {}
    setLoading(false);
  }, [page, unreadOnly]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      window.dispatchEvent(new CustomEvent('notifications:refresh'));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('Все уведомления прочитаны');
      window.dispatchEvent(new CustomEvent('notifications:refresh'));
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setPagination((prev) => ({ ...prev, total: prev.total - 1 }));
    } catch {}
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Уведомления</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-primary-600">{unreadCount} непрочитанных</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setUnreadOnly(!unreadOnly); setPage(1); }}
            className={`btn-secondary text-sm ${unreadOnly ? 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400' : ''}`}
          >
            <Bell className="w-4 h-4" />
            {unreadOnly ? 'Все' : 'Непрочитанные'}
          </button>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="btn-secondary text-sm">
              <CheckCheck className="w-4 h-4" />
              Прочитать все
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <BellOff className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Уведомлений нет</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {notifications.map((notification) => {
              const Icon = TYPE_ICONS[notification.type] || Bell;
              const colorClass = TYPE_COLORS[notification.type] || 'text-gray-500 bg-gray-50 dark:bg-gray-800';

              return (
                <div
                  key={notification.id}
                  className={`flex items-start gap-4 p-4 transition-colors ${
                    !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm font-medium ${!notification.read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                          {notification.title}
                          {!notification.read && (
                            <span className="ml-2 w-1.5 h-1.5 rounded-full bg-primary-500 inline-block" />
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{notification.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatRelative(notification.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {notification.entityId && (
                          <Link
                            href={`/orders/${notification.entityId}`}
                            onClick={() => !notification.read && handleMarkRead(notification.id)}
                            className="text-xs text-primary-600 hover:underline px-1"
                          >
                            Открыть
                          </Link>
                        )}
                        {!notification.read && (
                          <button
                            onClick={() => handleMarkRead(notification.id)}
                            className="p-1.5 text-gray-400 hover:text-primary-600 rounded transition-colors"
                            title="Отметить прочитанным"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Pagination
          page={pagination.page}
          pages={pagination.pages}
          total={pagination.total}
          limit={pagination.limit}
          onChange={setPage}
        />
      </div>
    </div>
  );
}
