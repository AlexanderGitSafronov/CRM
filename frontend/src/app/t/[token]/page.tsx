'use client';

// Публічна сторінка відстеження замовлення — посилання на неї надсилається
// клієнту в SMS/Viber. НЕ під (crm)-лейаутом: ніяких auth-провайдерів,
// тільки root layout (globals.css + тема). Дані тягнемо з публічного endpoint
// бекенда за токеном замовлення.

import { useEffect, useState } from 'react';
import {
  Package,
  Truck,
  CheckCircle2,
  Home,
  ClipboardCheck,
  MapPin,
  ExternalLink,
  PackageX,
  Loader2,
} from 'lucide-react';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

interface TrackItem {
  name: string;
  quantity: number;
}

interface TrackData {
  orderNum: number;
  status: string;
  brandName?: string | null;
  brandLogo?: string | null;
  deliveryCity?: string | null;
  deliveryAddress?: string | null;
  recipientName?: string | null;
  trackingNumber?: string | null;
  items?: TrackItem[];
  createdAt?: string | null;
  shippedAt?: string | null;
  npArrivedAt?: string | null;
  deliveredAt?: string | null;
}

// Кроки таймлайну, які бачить клієнт. Реальних статусів більше (PROCESSING,
// CALLED тощо) — мапимо їх на ці п'ять видимих стадій.
const STEPS = [
  { key: 'created', label: 'Прийнято', icon: ClipboardCheck },
  { key: 'confirmed', label: 'Підтверджено', icon: CheckCircle2 },
  { key: 'shipped', label: 'Відправлено', icon: Truck },
  { key: 'arrived', label: 'Прибуло у відділення', icon: MapPin },
  { key: 'delivered', label: 'Отримано', icon: Home },
] as const;

// Індекс поточного кроку (0..4) за статусом замовлення.
function statusToStepIndex(status: string): number {
  switch (status) {
    case 'NEW':
    case 'PROCESSING':
    case 'CALLED':
    case 'NO_ANSWER':
      return 0;
    case 'CONFIRMED':
      return 1;
    case 'SHIPPED':
      return 2;
    case 'DELIVERED':
      return 4;
    default:
      return 0;
  }
}

// Терміновані статуси — показуємо окремим бейджем, а не у стрічці кроків.
function terminalBadge(status: string): { label: string; cls: string } | null {
  if (status === 'CANCELLED')
    return { label: 'Замовлення скасовано', cls: 'bg-red-100 text-red-700' };
  if (status === 'RETURNED')
    return { label: 'Повернення', cls: 'bg-orange-100 text-orange-700' };
  return null;
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TrackOrderPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`${API_URL}/api/public/track/${encodeURIComponent(token)}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const json = (await res.json()) as TrackData;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 flex items-start justify-center px-4 py-8 sm:py-14">
      <div className="w-full max-w-lg">
        {loading ? (
          <TrackSkeleton />
        ) : notFound || !data ? (
          <NotFoundCard />
        ) : (
          <TrackCard data={data} />
        )}

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-600">
          Відстеження замовлення
        </p>
      </div>
    </div>
  );
}

function TrackCard({ data }: { data: TrackData }) {
  const currentStep = statusToStepIndex(data.status);
  const badge = terminalBadge(data.status);
  const ttn = data.trackingNumber?.trim();

  // Якщо посилка прибула у відділення (батч 1: npArrivedAt) і ще не отримана —
  // підсвічуємо крок "Прибуло". DELIVERED перекриває це (currentStep=4).
  let activeStep = currentStep;
  if (data.npArrivedAt && data.status !== 'DELIVERED') {
    activeStep = Math.max(activeStep, 3);
  }

  // Дати під відповідними кроками.
  const stepDates: Record<string, string | null> = {
    created: formatDate(data.createdAt),
    shipped: formatDate(data.shippedAt),
    arrived: formatDate(data.npArrivedAt),
    delivered: formatDate(data.deliveredAt),
  };

  return (
    <div className="card overflow-hidden">
      {/* Шапка з брендом */}
      <div className="bg-primary-600 dark:bg-primary-700 px-5 py-6 sm:px-7 text-white">
        <div className="flex items-center gap-3">
          {data.brandLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.brandLogo}
              alt={data.brandName || 'Logo'}
              className="w-12 h-12 rounded-xl object-cover bg-white/10 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6 text-white" />
            </div>
          )}
          <div className="min-w-0">
            {data.brandName && (
              <p className="text-sm font-medium text-white/80 truncate">{data.brandName}</p>
            )}
            <h1 className="text-xl font-bold leading-tight">Замовлення №{data.orderNum}</h1>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-7 space-y-6">
        {badge && (
          <div className={`rounded-lg px-4 py-3 text-sm font-medium ${badge.cls} dark:bg-opacity-20`}>
            {badge.label}
          </div>
        )}

        {/* Горизонтальний степпер */}
        {!badge && <Stepper activeStep={activeStep} stepDates={stepDates} />}

        {/* ТТН */}
        {ttn && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">
              Номер ТТН (Нова Пошта)
            </p>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-base font-semibold text-gray-900 dark:text-white tracking-wide">
                {ttn}
              </span>
              <a
                href={`https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(ttn)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-sm font-medium hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors shrink-0"
              >
                Відстежити
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Доставка */}
        {(data.deliveryCity || data.deliveryAddress || data.recipientName) && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              Доставка
            </h2>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
              {data.deliveryCity && <p>{data.deliveryCity}</p>}
              {data.deliveryAddress && <p>{data.deliveryAddress}</p>}
              {data.recipientName && (
                <p className="text-gray-400 dark:text-gray-500">Отримувач: {data.recipientName}</p>
              )}
            </div>
          </div>
        )}

        {/* Склад замовлення */}
        {data.items && data.items.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              Склад замовлення
            </h2>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.items.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-gray-700 dark:text-gray-300 min-w-0 break-words">{it.name}</span>
                  <span className="text-gray-400 dark:text-gray-500 shrink-0 whitespace-nowrap">
                    × {it.quantity}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Stepper({
  activeStep,
  stepDates,
}: {
  activeStep: number;
  stepDates: Record<string, string | null>;
}) {
  return (
    <div>
      <div className="flex items-start">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const done = i < activeStep;
          const current = i === activeStep;
          const reached = done || current;
          const date = stepDates[step.key];
          return (
            <div key={step.key} className="flex-1 flex flex-col items-center text-center relative">
              {/* Лінія до попереднього кроку */}
              {i > 0 && (
                <div
                  className={`absolute top-4 right-1/2 w-full h-0.5 ${
                    i <= activeStep ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  reached
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                } ${current ? 'ring-4 ring-primary-200 dark:ring-primary-900/50' : ''}`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span
                className={`mt-2 text-[11px] leading-tight ${
                  reached
                    ? 'text-gray-900 dark:text-white font-medium'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {step.label}
              </span>
              {date && reached && (
                <span className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">{date}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NotFoundCard() {
  return (
    <div className="card p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
        <PackageX className="w-7 h-7 text-gray-400" />
      </div>
      <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">
        Замовлення не знайдено
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
        Можливо, посилання застаріло або введено невірно. Зверніться до магазину, якщо у вас є питання щодо замовлення.
      </p>
    </div>
  );
}

function TrackSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="bg-primary-600/80 dark:bg-primary-700/80 px-5 py-6 sm:px-7 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-white/20" />
        <div className="space-y-2">
          <div className="h-3 w-24 bg-white/20 rounded" />
          <div className="h-5 w-40 bg-white/30 rounded" />
        </div>
      </div>
      <div className="p-5 sm:p-7 space-y-6">
        <div className="flex justify-between">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="h-2 w-10 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
        <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        <div className="space-y-2">
          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="flex items-center justify-center pt-2 text-gray-300 dark:text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      </div>
    </div>
  );
}
