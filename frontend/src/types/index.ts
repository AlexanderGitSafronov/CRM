export type Role = 'ADMIN' | 'MANAGER' | 'VIEWER' | 'CALL_CENTER';

export type OrderStatus =
  | 'NEW'
  | 'PROCESSING'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'CALLED'
  | 'NO_ANSWER';

export type OrderSource =
  | 'WEBSITE'
  | 'LANDING'
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'MANUAL'
  | 'TELEGRAM'
  | 'WEBHOOK';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'PRO' | 'BUSINESS';
  maxUsers?: number;
  maxOrders?: number;
  maxProducts?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  active?: boolean;
  createdAt?: string;
  emailVerified?: boolean;
  organization?: Organization;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
  notes?: string;
  isBlacklisted?: boolean;
  blacklistReason?: string;
  ltv?: number;
  ordersCount?: number;
  createdAt: string;
  orders?: Order[];
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  image?: string;
  active: boolean;
  margin?: number;
  marginPercent?: number;
  totalSold?: number;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  productId?: string;
  product?: { id: string; sku?: string };
}

export interface Order {
  id: string;
  orderNum: number;
  status: OrderStatus;
  source: OrderSource;
  comment?: string;
  total: number;
  deliveryService?: string;
  deliveryCity?: string;
  deliveryAddress?: string;
  recipientName?: string;
  npCityRef?: string;
  npWarehouseRef?: string;
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    city?: string;
    address?: string;
    isBlacklisted?: boolean;
    blacklistReason?: string;
  };
  manager?: {
    id: string;
    name: string;
    email: string;
  } | null;
  items: OrderItem[];
  history?: OrderHistoryEntry[];
}

export interface OrderHistoryEntry {
  id: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  userId?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  entityId?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: 'ADVERTISING' | 'SERVICES' | 'PURCHASE' | 'OTHER';
  amount: number;
  description?: string;
  date: string;
  createdAt: string;
}

export interface Analytics {
  orders: {
    total: number;
    new: number;
    delivered: number;
    cancelled: number;
  };
  revenue: number;
  expenses: number;
  profit: number;
  customers: { new: number; total: number };
  products: { total: number; lowStock: number };
  unreadNotifications: number;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Новый',
  PROCESSING: 'В обработке',
  CONFIRMED: 'Подтверждён',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отказ',
  RETURNED: 'Возврат',
  CALLED: 'Прозвонили',
  NO_ANSWER: 'Недозвон',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PROCESSING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  CONFIRMED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  SHIPPED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  DELIVERED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  RETURNED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  CALLED: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  NO_ANSWER: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

export const ORDER_SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'Сайт',
  LANDING: 'Лендинг',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  MANUAL: 'Менеджер',
  TELEGRAM: 'Telegram',
  WEBHOOK: 'Webhook',
};

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  ADVERTISING: 'Реклама',
  SERVICES: 'Услуги',
  PURCHASE: 'Закупка',
  OTHER: 'Прочее',
};
