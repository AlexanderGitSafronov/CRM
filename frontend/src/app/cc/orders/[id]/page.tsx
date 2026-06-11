'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { ORDER_STATUS_LABELS, type Order, type OrderStatus } from '@/types';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  Package,
  MessageSquare,
  CheckCircle2,
  ChevronDown,
  BookOpen,
  XCircle,
  PhoneMissed,
  PhoneCall,
  Truck,
  Plus,
  Save,
  Mail,
  MapPin,
  User,
  ShieldAlert,
  Bell,
  Clock,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import NovaPoshtaSelect from '@/components/nova-poshta/NovaPoshtaSelect';
import useHotkeys from '@/hooks/useHotkeys';

const DELIVERY_SERVICES = [
  { value: 'NOVA_POSHTA', label: 'Нова Пошта' },
  { value: 'UKRPOSHTA', label: 'Укрпошта' },
  { value: 'COURIER', label: 'Кур\'єр' },
  { value: 'PICKUP', label: 'Самовивіз' },
];

const UPSELL_PRESETS = [100, 200, 500, 1000];

const CC_STATUSES: {
  value: OrderStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  active: string;
}[] = [
  {
    value: 'CALLED',
    label: 'Прозвонили',
    icon: PhoneCall,
    color: 'border-teal-200 text-teal-700 dark:border-teal-800 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20',
    active: 'bg-teal-500 border-teal-500 text-white dark:bg-teal-600 dark:border-teal-600',
  },
  {
    value: 'NO_ANSWER',
    label: 'Недозвон',
    icon: PhoneMissed,
    color: 'border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20',
    active: 'bg-amber-500 border-amber-500 text-white dark:bg-amber-600 dark:border-amber-600',
  },
  {
    value: 'CONFIRMED',
    label: 'Підтверджено',
    icon: CheckCircle2,
    color: 'border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20',
    active: 'bg-purple-500 border-purple-500 text-white dark:bg-purple-600 dark:border-purple-600',
  },
  {
    value: 'CANCELLED',
    label: 'Відмова',
    icon: XCircle,
    color: 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
    active: 'bg-red-500 border-red-500 text-white dark:bg-red-600 dark:border-red-600',
  },
];

function CcOrderDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Чи прийшов оператор із черги — тоді після збереження ведемо до наступної заявки
  const fromQueue = searchParams.get('from') === 'queue';
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [deliveryService, setDeliveryService] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [npCityRef, setNpCityRef] = useState('');
  const [npWarehouseRef, setNpWarehouseRef] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [comment, setComment] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showScript, setShowScript] = useState(false);
  const [upsellAmount, setUpsellAmount] = useState('');
  const [customUpsell, setCustomUpsell] = useState('');

  // Callbacks
  const [callbacks, setCallbacks] = useState<{ id: string; scheduledAt: string; note: string | null; done: boolean; manager?: { name: string } | null }[]>([]);
  const [cbScheduledAt, setCbScheduledAt] = useState('');
  const [cbNote, setCbNote] = useState('');
  const [cbSaving, setCbSaving] = useState(false);

  const loadCallbacks = async () => {
    try {
      const res = await api.get(`/callbacks?orderId=${id}&done=false`);
      setCallbacks(res.data ?? []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/orders/${id}`);
        const o: Order = res.data;
        setOrder(o);
        setStatus(o.status);
        setDeliveryService(o.deliveryService ?? '');
        setDeliveryCity(o.deliveryCity ?? o.customer.city ?? '');
        setDeliveryAddress(o.deliveryAddress ?? o.customer.address ?? '');
        setNpCityRef(o.npCityRef ?? '');
        setNpWarehouseRef(o.npWarehouseRef ?? '');
        setRecipientName(o.recipientName ?? o.customer.name);
        setComment(o.comment ?? '');
        setCancelReason((o as Order & { cancelReason?: string }).cancelReason ?? '');
      } catch {
        toast.error('Заказ не найден');
        router.push('/cc/orders');
      }
      setLoading(false);
    };
    load();
    loadCallbacks();
  }, [id, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddCallback = async () => {
    if (!cbScheduledAt) return;
    setCbSaving(true);
    try {
      await api.post('/callbacks', { orderId: id, scheduledAt: cbScheduledAt, note: cbNote.trim() || null });
      setCbScheduledAt('');
      setCbNote('');
      await loadCallbacks();
      toast.success('Перезвін заплановано');
    } catch {
      toast.error('Помилка');
    }
    setCbSaving(false);
  };

  const handleDoneCallback = async (cbId: string) => {
    try {
      await api.patch(`/callbacks/${cbId}/done`);
      await loadCallbacks();
    } catch { toast.error('Помилка'); }
  };

  const handleDeleteCallback = async (cbId: string) => {
    try {
      await api.delete(`/callbacks/${cbId}`);
      await loadCallbacks();
    } catch { toast.error('Помилка'); }
  };

  // Після збереження зі стану «черга» — ведемо оператора до наступної заявки,
  // не повертаючи його у список (робота дзвінок-за-дзвінком)
  const goToNextInQueue = async () => {
    try {
      const res = await api.get('/orders/queue');
      const items: { id: string }[] = res.data.items ?? [];
      const next = items.find((it) => it.id !== id);
      if (next) {
        router.push(`/cc/orders/${next.id}?from=queue`);
        return;
      }
    } catch { /* ignore — впадемо у фолбек нижче */ }
    toast.success('Черга порожня 🎉');
    router.push('/cc/orders');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const finalUpsell = Number(customUpsell) || Number(upsellAmount) || 0;
      const res = await api.patch(`/orders/${id}`, {
        status: status || undefined,
        deliveryService: deliveryService || null,
        deliveryCity: deliveryCity.trim() || null,
        deliveryAddress: deliveryAddress.trim() || null,
        npCityRef: npCityRef || null,
        npWarehouseRef: npWarehouseRef || null,
        recipientName: recipientName.trim() || null,
        comment: comment.trim() || null,
        cancelReason: cancelReason.trim() || null,
        upsellAmount: finalUpsell > 0 ? finalUpsell : undefined,
      });
      setOrder(res.data);
      setUpsellAmount('');
      setCustomUpsell('');
      toast.success('Збережено');
      window.dispatchEvent(new CustomEvent('cc:status_changed'));
      if (fromQueue) {
        await goToNextInQueue();
      }
    } catch {
      toast.error('Помилка збереження');
    }
    setSaving(false);
  };

  // Хоткеї оператора: 1–4 — статус дзвінка (у показаному порядку), Cmd/Ctrl+Enter — зберегти.
  // Цифри ігноруються під час набору в полях (поведінка useHotkeys), mod+enter — спрацьовує і в полях.
  useHotkeys(
    {
      '1': () => order && setStatus((prev) => (prev === CC_STATUSES[0].value ? order.status : CC_STATUSES[0].value)),
      '2': () => order && setStatus((prev) => (prev === CC_STATUSES[1].value ? order.status : CC_STATUSES[1].value)),
      '3': () => order && setStatus((prev) => (prev === CC_STATUSES[2].value ? order.status : CC_STATUSES[2].value)),
      '4': () => order && setStatus((prev) => (prev === CC_STATUSES[3].value ? order.status : CC_STATUSES[3].value)),
      'mod+enter': () => handleSave(),
    },
    { enabled: !loading && !saving }
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!order) return null;

  const effectiveUpsell = Number(customUpsell) || Number(upsellAmount) || 0;
  const deliveryLabel =
    deliveryService === 'NOVA_POSHTA' ? 'Відділення / Поштомат' :
    deliveryService === 'UKRPOSHTA'   ? 'Відділення Укрпошти' :
    deliveryService === 'COURIER'     ? 'Адреса доставки' :
    'Адреса / Відділення';
  const deliveryPlaceholder =
    deliveryService === 'NOVA_POSHTA' ? 'Відділення №12 або Поштомат №1234' :
    deliveryService === 'UKRPOSHTA'   ? 'Відділення №1' :
    deliveryService === 'COURIER'     ? 'вул. Хрещатик, 1, кв. 5' :
    'Введіть адресу...';

  return (
    <div className="space-y-4 pb-24">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(fromQueue ? '/cc/queue' : '/cc/orders')}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Замовлення #{order.orderNum}
            </h1>
            <StatusBadge status={order.status as OrderStatus} />
          </div>
          <p className="text-sm text-gray-400">{formatDate(order.createdAt)}</p>
        </div>
      </div>

      {/* Blacklist warning */}
      {order.customer.isBlacklisted && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl p-4">
          <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400">Клієнт у чорному списку</p>
            {order.customer.blacklistReason && (
              <p className="text-sm text-red-600 dark:text-red-500 mt-0.5">{order.customer.blacklistReason}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── LEFT: Клієнт + Товари + Коментар ── */}
        <div className="space-y-4">

          {/* Клієнт */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Клієнт</h2>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Ім'я</p>
                <p className="font-medium text-gray-900 dark:text-white">{order.customer.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Телефон</p>
                <a
                  href={`tel:${order.customer.phone}`}
                  className="text-xl font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1.5"
                >
                  <Phone className="w-4 h-4" />
                  {order.customer.phone}
                </a>
              </div>
              {order.customer.email && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Email</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    {order.customer.email}
                  </p>
                </div>
              )}
              {(order.customer.city || order.customer.address) && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Адреса з бази</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <span>{[order.customer.city, order.customer.address].filter(Boolean).join(', ')}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Товари */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Товари</h2>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                  <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0 ml-2">× {item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Коментар */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Коментар</h2>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Нотатки по замовленню..."
              rows={3}
              className="input w-full resize-none"
            />
          </div>
        </div>

        {/* ── RIGHT: Статус + Доставка + Допродаж ── */}
        <div className="space-y-4">

          {/* Статус дзвінка */}
          <div className="card p-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Статус дзвінка</h2>
            <div className="grid grid-cols-2 gap-2">
              {CC_STATUSES.map((s, i) => {
                const Icon = s.icon;
                const isActive = status === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => setStatus(isActive ? order.status : s.value)}
                    className={cn(
                      'relative flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                      isActive ? s.active : s.color
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {s.label}
                    <kbd
                      aria-hidden
                      className={cn(
                        'absolute top-1 right-1 hidden sm:inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded text-[10px] font-semibold leading-none border',
                        isActive
                          ? 'border-white/40 text-white/80'
                          : 'border-gray-200 dark:border-gray-700 text-gray-400'
                      )}
                    >
                      {i + 1}
                    </kbd>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Причина відмови — показується тільки якщо CANCELLED */}
          {status === 'CANCELLED' && (
            <div className="card p-4 border-red-200 dark:border-red-800 ring-1 ring-red-200 dark:ring-red-800">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-4 h-4 text-red-500" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Причина відмови</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  'Дорого',
                  'Передумав',
                  'Вже купив',
                  'Не додзвонились',
                  'Не той товар',
                  'Не влаштовує доставка',
                  'Немає грошей',
                  'Інше',
                ].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setCancelReason(cancelReason === reason ? '' : reason)}
                    className={cn(
                      'px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left',
                      cancelReason === reason
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 hover:text-red-700'
                    )}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Або введіть вручну..."
                className="input w-full text-sm"
              />
            </div>
          )}

          {/* Скрипт продажу */}
          <div className="card p-4">
            <button
              onClick={() => setShowScript((p) => !p)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-gray-900 dark:text-white text-sm">Скрипт дзвінка</span>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', showScript && 'rotate-180')} />
            </button>
            {showScript && (
              <div className="mt-3 space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="font-semibold text-blue-700 dark:text-blue-400 mb-1">1. Привітання</p>
                  <p className="text-gray-600 dark:text-gray-400 italic">
                    &ldquo;Добрий день, мене звати [ім'я], телефоную з приводу вашого замовлення #<strong>{order.orderNum}</strong>. Зручно зараз говорити?&rdquo;
                  </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">2. Підтвердження</p>
                  <p className="text-gray-600 dark:text-gray-400 italic">
                    &ldquo;Ваше замовлення: {order.items.map(i => `${i.name} × ${i.quantity}`).join(', ')}. Загальна сума {order.total} грн. Все вірно?&rdquo;
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                  <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">3. Допродаж</p>
                  <p className="text-gray-600 dark:text-gray-400 italic">
                    &ldquo;Є можливість додати до замовлення [доп. товар] зі знижкою. Хочете скористатись?&rdquo;
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                  <p className="font-semibold text-purple-700 dark:text-purple-400 mb-1">4. Доставка</p>
                  <p className="text-gray-600 dark:text-gray-400 italic">
                    &ldquo;Уточніть, будь ласка, місто та відділення Нової Пошти для відправки. Ваше замовлення відправимо протягом 1-2 робочих днів.&rdquo;
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">5. Завершення</p>
                  <p className="text-gray-600 dark:text-gray-400 italic">
                    &ldquo;Дякуємо за замовлення! Після відправки ми надішлемо SMS з номером ТТН. Гарного дня!&rdquo;
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Куди відправляти */}
          <div className="card p-4 ring-2 ring-primary-100 dark:ring-primary-900/30">
            <div className="flex items-center gap-2 mb-3">
              <Truck className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Куди відправляти</h2>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {DELIVERY_SERVICES.map((ds) => (
                  <button
                    key={ds.value}
                    onClick={() => setDeliveryService(deliveryService === ds.value ? '' : ds.value)}
                    className={cn(
                      'px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                      deliveryService === ds.value
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    )}
                  >
                    {ds.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="ПІБ одержувача"
                  className="input w-full pl-9"
                />
              </div>

              {/* Nova Poshta: smart city + warehouse picker */}
              {deliveryService === 'NOVA_POSHTA' ? (
                <NovaPoshtaSelect
                  cityValue={deliveryCity}
                  addressValue={deliveryAddress}
                  onCityChange={setDeliveryCity}
                  onAddressChange={setDeliveryAddress}
                  onCityRefChange={setNpCityRef}
                  onWarehouseRefChange={setNpWarehouseRef}
                />
              ) : (
                <>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={deliveryCity}
                      onChange={(e) => setDeliveryCity(e.target.value)}
                      placeholder="Місто"
                      className="input w-full pl-9"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder={deliveryPlaceholder}
                      className="input w-full"
                    />
                    {deliveryService && deliveryLabel !== 'Адреса / Відділення' && (
                      <p className="text-xs text-gray-400 mt-1">{deliveryLabel}</p>
                    )}
                  </div>
                </>
              )}

              {/* Summary */}
              {(deliveryService || deliveryCity || deliveryAddress) && (
                <div className="bg-primary-50 dark:bg-primary-900/10 rounded-lg p-3 text-sm space-y-0.5">
                  {deliveryService && (
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="text-gray-400">Доставка: </span>
                      {DELIVERY_SERVICES.find(d => d.value === deliveryService)?.label}
                    </p>
                  )}
                  {recipientName && (
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="text-gray-400">Одержувач: </span>{recipientName}
                    </p>
                  )}
                  {deliveryCity && (
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="text-gray-400">Місто: </span>{deliveryCity}
                    </p>
                  )}
                  {deliveryAddress && (
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="text-gray-400">Адреса: </span>{deliveryAddress}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Перезвін */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-orange-500" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Перезвін</h2>
              {callbacks.length > 0 && (
                <span className="ml-auto text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-semibold px-2 py-0.5 rounded-full">
                  {callbacks.length}
                </span>
              )}
            </div>

            {/* Existing callbacks */}
            {callbacks.length > 0 && (
              <div className="space-y-2 mb-3">
                {callbacks.map((cb) => (
                  <div key={cb.id} className="flex items-start gap-2 bg-orange-50 dark:bg-orange-900/10 rounded-lg p-2.5 border border-orange-100 dark:border-orange-900/30">
                    <Clock className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {new Date(cb.scheduledAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {cb.note && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{cb.note}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleDoneCallback(cb.id)}
                        className="p-1 rounded text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                        title="Виконано"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCallback(cb.id)}
                        className="p-1 rounded text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                        title="Видалити"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add callback form */}
            <div className="space-y-2">
              <input
                type="datetime-local"
                value={cbScheduledAt}
                onChange={(e) => setCbScheduledAt(e.target.value)}
                className="input w-full text-sm"
                min={new Date().toISOString().slice(0, 16)}
              />
              <input
                type="text"
                value={cbNote}
                onChange={(e) => setCbNote(e.target.value)}
                placeholder="Нотатка (необов'язково)"
                className="input w-full text-sm"
              />
              <button
                onClick={handleAddCallback}
                disabled={!cbScheduledAt || cbSaving}
                className="w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-medium transition-colors"
              >
                {cbSaving ? 'Збереження...' : '+ Запланувати перезвін'}
              </button>
            </div>
          </div>

          {/* Доп. продаж */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Доп. продаж</h2>
              {effectiveUpsell > 0 && (
                <span className="ml-auto text-sm font-bold text-green-600 dark:text-green-400">
                  +{effectiveUpsell} грн
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {UPSELL_PRESETS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => {
                    setUpsellAmount(upsellAmount === String(amount) ? '' : String(amount));
                    setCustomUpsell('');
                  }}
                  className={cn(
                    'py-2 rounded-lg border text-sm font-semibold transition-all',
                    upsellAmount === String(amount)
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 hover:text-green-700'
                  )}
                >
                  +{amount}
                </button>
              ))}
            </div>
            <div className="relative">
              <input
                type="number"
                value={customUpsell}
                onChange={(e) => {
                  setCustomUpsell(e.target.value);
                  setUpsellAmount('');
                }}
                placeholder="Інша сума (грн)"
                min="0"
                className="input w-full pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">грн</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── STICKY SAVE ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {status && status !== order.status && (
              <span>
                Статус → <span className="font-semibold text-gray-900 dark:text-white">
                  {ORDER_STATUS_LABELS[status as OrderStatus]}
                </span>
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary gap-2 px-8 shrink-0"
          >
            {saving
              ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              : <Save className="w-4 h-4" />
            }
            {fromQueue ? 'Зберегти і далі' : 'Зберегти'}
            {fromQueue && !saving && <ArrowRight className="w-4 h-4" />}
            <kbd
              aria-hidden
              className="hidden sm:inline-flex items-center justify-center h-5 px-1.5 ml-1 rounded text-[10px] font-semibold leading-none border border-white/40 text-white/80"
            >
              ⌘↵
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CcOrderDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      }
    >
      <CcOrderDetailContent />
    </Suspense>
  );
}
