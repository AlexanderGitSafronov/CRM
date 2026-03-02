'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import Pagination from '@/components/ui/Pagination';
import type { Customer, Pagination as PaginationType } from '@/types';
import { Search, Users, Phone, Mail, MapPin, TrendingUp, RefreshCw, X } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({ total: 0, page: 1, limit: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/customers', {
        params: { page, limit: 20, ...(search && { search }) },
      });
      setCustomers(res.data.customers);
      setPagination(res.data.pagination);
    } catch {}
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setPage(1), 400);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Клиенты</h1>
          <p className="text-sm text-gray-400">{pagination.total} клиентов</p>
        </div>
      </div>

      <div className="card p-3 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Поиск по имени, телефону, email..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        {search && (
          <button onClick={() => { setSearch(''); setPage(1); }} className="btn-secondary px-2">
            <X className="w-4 h-4" />
          </button>
        )}
        <button onClick={fetchCustomers} className="btn-secondary p-2" title="Обновить">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                <th className="text-left table-header p-4">Клиент</th>
                <th className="text-left table-header p-4 hidden sm:table-cell">Контакты</th>
                <th className="text-left table-header p-4 hidden md:table-cell">Город</th>
                <th className="text-left table-header p-4">Заказов</th>
                <th className="text-left table-header p-4">LTV</th>
                <th className="text-left table-header p-4 hidden lg:table-cell">Зарегистрирован</th>
                <th className="p-4 w-10" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>Клиентов не найдено</p>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="p-4">
                      <Link href={`/customers/${customer.id}`} className="flex items-center gap-3 group">
                        <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">
                            {customer.name?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">
                            {customer.name}
                          </p>
                          <p className="text-xs text-gray-400">{customer.phone}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {customer.phone}
                        </div>
                        {customer.email && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Mail className="w-3 h-3" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      {customer.city ? (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          {customer.city}
                        </div>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {customer.ordersCount ?? 0}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(customer.ltv ?? 0)}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <span className="text-sm text-gray-400">{formatDate(customer.createdAt)}</span>
                    </td>
                    <td className="p-4">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        Подробнее
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
