'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ShoppingCart, User as UserIcon, Package, Loader2, Phone, Mail, MapPin, X } from 'lucide-react';
import api from '@/lib/api';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, type OrderStatus } from '@/types';

interface SearchOrder {
  id: string;
  orderNum: number;
  status: string;
  total: number;
  createdAt: string;
  customer: { name: string; phone: string };
}

interface SearchCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  ordersCount: number;
}

interface SearchProduct {
  id: string;
  name: string;
  sku?: string;
  salePrice: number;
  stock: number;
  image?: string;
}

interface SearchResults {
  orders: SearchOrder[];
  customers: SearchCustomer[];
  products: SearchProduct[];
}

export default function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ orders: [], customers: [], products: [] });
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Порядковый номер запроса поиска: устаревший ответ не должен перетереть свежий.
  const searchSeq = useRef(0);

  // Open with Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults({ orders: [], customers: [], products: [] });
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({ orders: [], customers: [], products: [] });
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const myReq = ++searchSeq.current;
      try {
        const res = await api.get('/search', { params: { q: query } });
        if (myReq !== searchSeq.current) return; // устаревший ответ
        setResults(res.data);
        setActiveIndex(0);
      } catch {
        if (myReq !== searchSeq.current) return;
        setResults({ orders: [], customers: [], products: [] });
      } finally {
        if (myReq === searchSeq.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Flat list for keyboard navigation
  const flatItems: Array<{ kind: 'order' | 'customer' | 'product'; id: string; payload: SearchOrder | SearchCustomer | SearchProduct }> = [
    ...results.orders.map((o) => ({ kind: 'order' as const, id: o.id, payload: o })),
    ...results.customers.map((c) => ({ kind: 'customer' as const, id: c.id, payload: c })),
    ...results.products.map((p) => ({ kind: 'product' as const, id: p.id, payload: p })),
  ];

  const navigate = useCallback((item: typeof flatItems[number]) => {
    setOpen(false);
    if (item.kind === 'order') router.push(`/orders/${item.id}`);
    if (item.kind === 'customer') router.push(`/customers/${item.id}`);
    if (item.kind === 'product') router.push(`/products`);
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!flatItems.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigate(flatItems[activeIndex]);
    }
  };

  if (!open) return null;

  const totalResults = results.orders.length + results.customers.length + results.products.length;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          {loading
            ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin shrink-0" />
            : <Search className="w-5 h-5 text-gray-400 shrink-0" />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Шукати заказы, клієнтів, товари..."
            className="flex-1 bg-transparent border-0 outline-none text-gray-900 dark:text-white placeholder-gray-400 text-base"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[11px] text-gray-500 font-mono">
            ESC
          </kbd>
          <button onClick={() => setOpen(false)} className="sm:hidden text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!query && (
            <div className="px-4 py-12 text-center text-sm text-gray-400">
              Почніть вводити для пошуку...
              <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">↑</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">↓</kbd>
                <span>навігація</span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">⏎</kbd>
                <span>відкрити</span>
              </div>
            </div>
          )}

          {query && query.length < 2 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              Введіть мінімум 2 символи
            </div>
          )}

          {query.length >= 2 && !loading && totalResults === 0 && (
            <div className="px-4 py-12 text-center text-sm text-gray-400">
              Нічого не знайдено по «{query}»
            </div>
          )}

          {results.orders.length > 0 && (
            <Section title="Заказы" count={results.orders.length}>
              {results.orders.map((o) => {
                const idx = flatItems.findIndex((i) => i.kind === 'order' && i.id === o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => navigate({ kind: 'order', id: o.id, payload: o })}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                      idx === activeIndex ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 dark:text-white text-sm">#{o.orderNum}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ORDER_STATUS_COLORS[o.status as OrderStatus] ?? ''}`}>
                          {ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                        </span>
                        <span className="text-xs text-gray-500 truncate">{o.customer.name} · {o.customer.phone}</span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">
                      {o.total.toLocaleString('uk-UA')} ₴
                    </span>
                  </button>
                );
              })}
            </Section>
          )}

          {results.customers.length > 0 && (
            <Section title="Клієнти" count={results.customers.length}>
              {results.customers.map((c) => {
                const idx = flatItems.findIndex((i) => i.kind === 'customer' && i.id === c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate({ kind: 'customer', id: c.id, payload: c })}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                      idx === activeIndex ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                      <UserIcon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{c.name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 truncate">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>
                        {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                        {c.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.city}</span>}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{c.ordersCount} замовл.</span>
                  </button>
                );
              })}
            </Section>
          )}

          {results.products.length > 0 && (
            <Section title="Товари" count={results.products.length}>
              {results.products.map((p) => {
                const idx = flatItems.findIndex((i) => i.kind === 'product' && i.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate({ kind: 'product', id: p.id, payload: p })}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                      idx === activeIndex ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">
                        {p.sku ? `${p.sku} · ` : ''}залишок: {p.stock}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">
                      {p.salePrice.toLocaleString('uk-UA')} ₴
                    </span>
                  </button>
                );
              })}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="sticky top-0 px-4 py-1.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800/50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
        <span>{title}</span>
        <span className="text-gray-400">{count}</span>
      </div>
      {children}
    </div>
  );
}
