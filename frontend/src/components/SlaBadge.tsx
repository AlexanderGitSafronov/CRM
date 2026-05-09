'use client';

import { Clock } from 'lucide-react';

const SLA_HOURS = 2; // mirror backend SLA_NEW_ORDER_HOURS default

export default function SlaBadge({ status, createdAt }: { status: string; createdAt: string }) {
  if (status !== 'NEW') return null;
  const ageMinutes = (Date.now() - new Date(createdAt).getTime()) / 60000;
  const ageHours = ageMinutes / 60;
  if (ageHours < SLA_HOURS) return null;

  const label = ageHours >= 24
    ? `${Math.floor(ageHours / 24)}д`
    : ageHours >= 1
      ? `${Math.floor(ageHours)}г`
      : `${Math.floor(ageMinutes)}хв`;

  // Heat: 2-4h amber, 4-12h orange, 12+h red
  const tone = ageHours >= 12
    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 ring-1 ring-rose-300/40'
    : ageHours >= 4
      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${tone}`}
      title={`У статусі NEW вже ${label} — перевищено SLA`}
    >
      <Clock className="w-3 h-3" />
      SLA {label}
    </span>
  );
}
