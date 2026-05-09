'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/stores/localeStore';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  Settings,
  Bell,
  LogOut,
  X,
  Zap,
  Wallet,
  Target,
} from 'lucide-react';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  badge?: number;
}

const navItems: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: BarChart3 },
  { href: '/orders', labelKey: 'nav.orders', icon: ShoppingCart },
  { href: '/customers', labelKey: 'nav.customers', icon: Users },
  { href: '/products', labelKey: 'nav.products', icon: Package },
  { href: '/analytics', labelKey: 'nav.analytics', icon: TrendingUp, roles: ['ADMIN', 'MANAGER'] },
  { href: '/goals', labelKey: 'nav.goals', icon: Target, roles: ['ADMIN', 'MANAGER'] },
  { href: '/analytics/cc-payroll', labelKey: 'nav.payroll', icon: Wallet, roles: ['ADMIN'] },
  { href: '/notifications', labelKey: 'nav.notifications', icon: Bell },
  { href: '/settings', labelKey: 'nav.settings', icon: Settings, roles: ['ADMIN'] },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  unreadNotifications?: number;
}

export default function Sidebar({ open, onClose, unreadNotifications = 0 }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const t = useT();

  const filteredItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 flex flex-col transition-transform duration-300',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 shadow-sm">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white truncate">
              CRM Pro
            </span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/analytics'
              ? pathname === '/analytics' || (pathname.startsWith('/analytics') && pathname !== '/analytics/cc-payroll')
              : pathname.startsWith(item.href);
            const badge = item.href === '/notifications' ? unreadNotifications : 0;

            const tourKey = item.href === '/orders' ? 'orders'
              : item.href === '/customers' ? 'customers'
              : item.href === '/products' ? 'products'
              : item.href === '/analytics' ? 'analytics'
              : item.href === '/settings' ? 'settings'
              : undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                data-tour={tourKey}
                className={cn('sidebar-link', isActive && 'active')}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
                <span className="flex-1">{t(item.labelKey)}</span>
                {badge > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">
                {user?.name?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {t(`role.${user?.role}`)}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>
    </>
  );
}
