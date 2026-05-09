'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import type { Analytics, Order } from '@/types';
import {
  ShoppingCart,
  Users,
  TrendingUp,
  Package,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Clock,
  RefreshCw,
  Truck,
  PhoneCall,
  PercentCircle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/stores/localeStore';
import PlanUsage from '@/components/PlanUsage';
import Sparkline from '@/components/Sparkline';
import SlaBadge from '@/components/SlaBadge';
import AchievementsCard from '@/components/AchievementsCard';
import GoalsCard from '@/components/GoalsCard';
import dynamic from 'next/dynamic';

// Leaflet is browser-only — dynamically loaded with no SSR
const CustomersMap = dynamic(() => import('@/components/CustomersMap'), { ssr: false });

interface DayData {
  date: string;
  orders: number;
  revenue: number;
}

interface Kpi {
  today: { orders: number; revenue: number };
  month: { orders: number; revenue: number; expenses: number; profit: number };
  inTransit: number;
  newOrders: number;
  redemptionRate: number | null;
  delivered30: number;
  returned30: number;
  pendingCallbacks: number;
  weeklyOrders: number;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const t = useT();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [chartData, setChartData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [analyticsRes, ordersRes, chartRes, kpiRes] = await Promise.all([
        api.get('/analytics/summary'),
        api.get('/orders', { params: { limit: 5, sortBy: 'createdAt', sortOrder: 'desc' } }),
        api.get('/analytics/orders-by-day', { params: { days: 14 } }),
        api.get('/analytics/kpi'),
      ]);
      setAnalytics(analyticsRes.data);
      setRecentOrders(ordersRes.data.orders);
      setChartData(chartRes.data);
      setKpi(kpiRes.data);
      setLastUpdated(new Date());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => loadData(true), 30000);

    // Обновление при новом заказе (SSE транслируется из layout)
    const onRefresh = () => loadData(true);
    window.addEventListener('dashboard:refresh', onRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('dashboard:refresh', onRefresh);
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const stats = [
    {
      title: t('dashboard.totalOrders'),
      value: analytics?.orders.total ?? 0,
      sub: `${analytics?.orders.new ?? 0} ${t('dashboard.newOrders')}`,
      icon: ShoppingCart,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      href: '/orders',
    },
    {
      title: t('dashboard.revenue'),
      value: formatCurrency(analytics?.revenue ?? 0),
      sub: `${t('dashboard.expenses')}: ${formatCurrency(analytics?.expenses ?? 0)}`,
      icon: TrendingUp,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      href: '/analytics',
    },
    {
      title: t('dashboard.profit'),
      value: formatCurrency(analytics?.profit ?? 0),
      sub: analytics && analytics.revenue > 0
        ? `${t('dashboard.margin')} ${((analytics.profit / analytics.revenue) * 100).toFixed(1)}%`
        : '',
      icon: ArrowUpRight,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      href: '/analytics',
    },
    {
      title: t('dashboard.customers'),
      value: analytics?.customers.total ?? 0,
      sub: `${analytics?.customers.new ?? 0} ${t('dashboard.newOrders')}`,
      icon: Users,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      href: '/customers',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Welcome */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.welcome')}, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {lastUpdated && (
            <span className="text-xs text-gray-400 hidden sm:block">
              {t('dashboard.updatedAt')} {lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => loadData(false)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      {kpi && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">{t('dashboard.todayOrders')}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {kpi.today.orders}
                  <span className="ml-1.5 inline-flex items-center px-1 py-0 rounded bg-emerald-500 text-white text-[9px] font-semibold align-middle animate-pulse">LIVE</span>
                </p>
                <p className="text-xs text-gray-400">{formatCurrency(kpi.today.revenue)}</p>
              </div>
            </div>
            {chartData.length > 1 && (
              <div className="-mx-1 -mb-1">
                <Sparkline data={chartData.slice(-7).map((d) => d.orders)} color="#3b82f6" height={24} />
              </div>
            )}
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">{t('dashboard.inTransit')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{kpi.inTransit}</p>
              <p className="text-xs text-gray-400">{t('dashboard.parcels')}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${kpi.redemptionRate !== null && kpi.redemptionRate >= 70 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <PercentCircle className={`w-4 h-4 ${kpi.redemptionRate !== null && kpi.redemptionRate >= 70 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`} />
            </div>
            <div>
              <p className="text-xs text-gray-400">{t('dashboard.redemption')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {kpi.redemptionRate !== null ? `${kpi.redemptionRate}%` : '—'}
              </p>
              <p className="text-xs text-gray-400">{kpi.delivered30}д / {kpi.returned30}в</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${kpi.pendingCallbacks > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
              <PhoneCall className={`w-4 h-4 ${kpi.pendingCallbacks > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-xs text-gray-400">Перезвони</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{kpi.pendingCallbacks}</p>
              <p className="text-xs text-gray-400">до завтра</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.title} href={stat.href} className="stat-card group hover:shadow-md transition-shadow">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Alerts */}
      <div className="flex flex-wrap gap-3">
        {(analytics?.orders.new ?? 0) > 0 && (
          <Link
            href="/orders?status=NEW"
            className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {analytics?.orders.new} новых заказов требуют обработки
          </Link>
        )}
        {(analytics?.products.lowStock ?? 0) > 0 && (
          <Link
            href="/products"
            className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-lg text-sm hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            {analytics?.products.lowStock} товаров с низким остатком
          </Link>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Выручка за 14 дней</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-100 dark:text-gray-800" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => v.slice(5)}
                tick={{ fontSize: 11, fill: 'currentColor' }}
                className="text-gray-500"
              />
              <YAxis
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: 'currentColor' }}
                className="text-gray-500"
              />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'Выручка']}
                labelFormatter={(l) => formatDate(l)}
                contentStyle={{ fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Orders chart */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Заказы за 14 дней</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-100 dark:text-gray-800" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => v.slice(5)}
                tick={{ fontSize: 11, fill: 'currentColor' }}
                className="text-gray-500"
              />
              <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-gray-500" />
              <Tooltip
                formatter={(v: number) => [v, 'Заказов']}
                labelFormatter={(l) => formatDate(l)}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Goals */}
      <GoalsCard />

      {/* Plan usage */}
      <PlanUsage />

      {/* Achievements */}
      <AchievementsCard />

      {/* Customers map */}
      <CustomersMap />

      {/* Recent orders */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Последние заказы</h2>
          </div>
          <Link href="/orders" className="text-sm text-primary-600 hover:underline">
            Все заказы →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left table-header p-4">№</th>
                <th className="text-left table-header p-4">Клиент</th>
                <th className="text-left table-header p-4 hidden sm:table-cell">Товары</th>
                <th className="text-left table-header p-4">Сумма</th>
                <th className="text-left table-header p-4">Статус</th>
                <th className="text-left table-header p-4 hidden md:table-cell">Дата</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td className="p-4">
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-medium text-primary-600 hover:underline text-sm"
                    >
                      #{order.orderNum}
                    </Link>
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {order.customer.name}
                      </p>
                      <p className="text-xs text-gray-400">{order.customer.phone}</p>
                    </div>
                  </td>
                  <td className="p-4 hidden sm:table-cell">
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
                      {order.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                    </p>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(order.total)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={order.status} />
                      <SlaBadge status={order.status} createdAt={order.createdAt} />
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="text-sm text-gray-400">
                      {formatDate(order.createdAt)}
                    </span>
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>Заказов ещё нет</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
