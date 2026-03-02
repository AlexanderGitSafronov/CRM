import { type ClassValue, clsx } from 'clsx';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string | Date, fmt = 'dd.MM.yyyy') {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt, { locale: ru });
}

export function formatDateTime(date: string | Date) {
  return formatDate(date, 'dd.MM.yyyy HH:mm');
}

export function formatRelative(date: string | Date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: ru });
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('uk-UA').format(n);
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function getErrorMessage(error: unknown): string {
  if ((error as { response?: { data?: { error?: string } } })?.response?.data?.error) {
    return (error as { response: { data: { error: string } } }).response.data.error;
  }
  if (error instanceof Error) return error.message;
  return 'Произошла ошибка';
}
