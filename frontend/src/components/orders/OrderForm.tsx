'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import type { Order, Product, User } from '@/types';
import { Plus, Trash2, Search, AlertCircle } from 'lucide-react';

interface CustomerSuggestion {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
  isBlacklisted?: boolean;
  blacklistReason?: string;
  ordersCount: number;
}

interface OrderFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  order?: Order;
}

interface ItemForm {
  id?: string;
  productId?: string;
  name: string;
  quantity: number;
  price: number;
}

const SOURCES = [
  { value: 'MANUAL', label: 'Менеджер' },
  { value: 'WEBSITE', label: 'Сайт' },
  { value: 'LANDING', label: 'Лендинг' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'TELEGRAM', label: 'Telegram' },
];

export default function OrderForm({ open, onClose, onSuccess, order }: OrderFormProps) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
  });
  const [items, setItems] = useState<ItemForm[]>([
    { name: '', quantity: 1, price: 0 },
  ]);
  const [source, setSource] = useState('MANUAL');
  const [managerId, setManagerId] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) {
      if (order) {
        setCustomer({
          name: order.customer.name,
          phone: order.customer.phone,
          email: order.customer.email || '',
          city: order.customer.city || '',
          address: '',
        });
        setItems(
          order.items.map((i) => ({
            id: i.id,
            productId: i.productId,
            name: i.name,
            quantity: i.quantity,
            price: i.price,
          }))
        );
        setSource(order.source);
        setManagerId(order.manager?.id || '');
        setComment(order.comment || '');
      } else {
        setCustomer({ name: '', phone: '', email: '', city: '', address: '' });
        setItems([{ name: '', quantity: 1, price: 0 }]);
        setSource('MANUAL');
        setManagerId('');
        setComment('');
      }
    }
  }, [open, order]);

  useEffect(() => {
    if (open) {
      Promise.all([
        api.get('/products', { params: { active: true, limit: 200 } }),
        api.get('/users').catch(() => ({ data: [] })),
      ]).then(([p, u]) => {
        setProducts(p.data.products);
        setManagers(u.data || []);
      }).catch(() => {});
    }
  }, [open]);

  // Reactive customer autocomplete (phone or name)
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeFieldRef, setActiveFieldRef] = useState<'phone' | 'name' | null>(null);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = (q: string) => {
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    if (q.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    autocompleteTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/search/customers/lookup', { params: { phone: q.trim() } });
        setSuggestions(res.data.customers || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 200);
  };

  const pickCustomer = (s: CustomerSuggestion) => {
    setCustomer({
      name: s.name,
      phone: s.phone,
      email: s.email || '',
      city: s.city || '',
      address: s.address || '',
    });
    setShowSuggestions(false);
    setActiveFieldRef(null);
    if (s.isBlacklisted) {
      toast.error(`⚠️ ЧОРНИЙ СПИСОК: ${s.blacklistReason || 'без причини'}`, { duration: 6000 });
    } else {
      toast.success(`Клієнт знайдений: ${s.name} (${s.ordersCount} замовл.)`);
    }
  };

  const selectProduct = (idx: number, product: Product) => {
    setItems((prev) => prev.map((item, i) =>
      i === idx
        ? { ...item, productId: product.id, name: product.name, price: product.salePrice }
        : item
    ));
    setProductSearch('');
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku?.toLowerCase().includes(productSearch.toLowerCase()))
  ).slice(0, 10);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.name.trim() || !customer.phone.trim()) {
      toast.error('Имя и телефон обязательны');
      return;
    }
    if (items.some((i) => !i.name.trim())) {
      toast.error('Укажите название товара');
      return;
    }

    setLoading(true);
    try {
      if (order) {
        await api.put(`/orders/${order.id}`, { items, source, managerId: managerId || null, comment });
      } else {
        await api.post('/orders', { customer, items, source, managerId: managerId || null, comment });
      }
      toast.success(order ? 'Заказ обновлён' : 'Заказ создан');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Ошибка';
      toast.error(msg);
    }
    setLoading(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={order ? `Редактировать заказ #${order.orderNum}` : 'Новый заказ'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Customer section */}
        {!order && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Клиент</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="label">Телефон *</label>
                <input
                  className="input"
                  value={customer.phone}
                  onChange={(e) => {
                    setCustomer((p) => ({ ...p, phone: e.target.value }));
                    fetchSuggestions(e.target.value);
                  }}
                  onFocus={() => {
                    setActiveFieldRef('phone');
                    if (suggestions.length) setShowSuggestions(true);
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="+380501234567"
                  required
                  autoComplete="off"
                />
                {showSuggestions && activeFieldRef === 'phone' && suggestions.length > 0 && (
                  <CustomerSuggestionList suggestions={suggestions} onPick={pickCustomer} />
                )}
              </div>
              <div className="relative">
                <label className="label">Имя *</label>
                <input
                  className="input"
                  value={customer.name}
                  onChange={(e) => {
                    setCustomer((p) => ({ ...p, name: e.target.value }));
                    fetchSuggestions(e.target.value);
                  }}
                  onFocus={() => {
                    setActiveFieldRef('name');
                    if (suggestions.length) setShowSuggestions(true);
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Иван Петров"
                  required
                  autoComplete="off"
                />
                {showSuggestions && activeFieldRef === 'name' && suggestions.length > 0 && (
                  <CustomerSuggestionList suggestions={suggestions} onPick={pickCustomer} />
                )}
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={customer.email}
                  onChange={(e) => setCustomer((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="label">Город</label>
                <input
                  className="input"
                  value={customer.city}
                  onChange={(e) => setCustomer((p) => ({ ...p, city: e.target.value }))}
                  placeholder="Киев"
                />
              </div>
            </div>
          </div>
        )}

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Товары</h3>
            {products.length > 0 && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  className="input pl-7 py-1 text-xs w-48"
                  placeholder="Найти товар..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onFocus={() => {}}
                />
                {productSearch && filteredProducts.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          const emptyIdx = items.findIndex((i) => !i.name);
                          if (emptyIdx >= 0) {
                            selectProduct(emptyIdx, p);
                          } else {
                            setItems((prev) => [...prev, { productId: p.id, name: p.name, quantity: 1, price: p.salePrice }]);
                          }
                          setProductSearch('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex justify-between items-center"
                      >
                        <div>
                          <span className="font-medium">{p.name}</span>
                          {p.sku && <span className="text-gray-400 text-xs ml-1">({p.sku})</span>}
                        </div>
                        <span className="text-primary-600 font-medium shrink-0">{p.salePrice} грн</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <div className="flex-1">
                  <input
                    className="input text-sm"
                    value={item.name}
                    onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))}
                    placeholder="Название товара"
                    required
                  />
                </div>
                <div className="w-20">
                  <input
                    className="input text-sm"
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, quantity: parseInt(e.target.value) || 1 } : it))}
                    placeholder="Кол."
                  />
                </div>
                <div className="w-28">
                  <input
                    className="input text-sm"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, price: parseFloat(e.target.value) || 0 } : it))}
                    placeholder="Цена"
                  />
                </div>
                <div className="w-24 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 text-right">
                  {(item.price * item.quantity).toLocaleString()} грн
                </div>
                <button
                  type="button"
                  onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                  disabled={items.length === 1}
                  className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-3">
            <button
              type="button"
              onClick={() => setItems((p) => [...p, { name: '', quantity: 1, price: 0 }])}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Добавить товар
            </button>
            <div className="text-right">
              <span className="text-sm text-gray-500">Итого: </span>
              <span className="font-bold text-lg text-gray-900 dark:text-white">
                {total.toLocaleString()} грн
              </span>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Источник</label>
            <select
              className="input"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Менеджер</label>
            <select
              className="input"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">Не назначен</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Комментарий</label>
          <textarea
            className="input min-h-[72px] resize-none"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Заметки к заказу..."
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
            Отмена
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : order ? (
              'Сохранить'
            ) : (
              'Создать заказ'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CustomerSuggestionList({
  suggestions, onPick,
}: { suggestions: CustomerSuggestion[]; onPick: (s: CustomerSuggestion) => void }) {
  return (
    <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
      {suggestions.map((s) => (
        <button
          key={s.id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onPick(s); }}
          className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
            s.isBlacklisted ? 'bg-red-50 dark:bg-red-900/10' : ''
          }`}
        >
          {s.isBlacklisted && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{s.name}</p>
            <p className="text-xs text-gray-500 truncate">
              {s.phone}{s.city ? ` · ${s.city}` : ''}
            </p>
          </div>
          <span className="text-xs text-gray-400 shrink-0">{s.ordersCount} зам.</span>
        </button>
      ))}
    </div>
  );
}
