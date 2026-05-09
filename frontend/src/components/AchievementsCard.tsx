'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Sparkles, Trophy, Award, Crown, PackageCheck, Truck,
  TrendingUp, DollarSign, Coins, Package, Users, Lock,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useT } from '@/stores/localeStore';

interface Achievement {
  code: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  achievedAt: string | null;
}

const ICONS: Record<string, LucideIcon> = {
  Sparkles, Trophy, Award, Crown, PackageCheck, Truck,
  TrendingUp, DollarSign, Coins, Package, Users,
};

const COLLAPSE_KEY = 'crm_achievements_collapsed';

export default function AchievementsCard() {
  const t = useT();
  const [data, setData] = useState<{ achievements: Achievement[]; unlockedCount: number; totalCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const load = async () => {
    try {
      const res = await api.get('/achievements');
      setData(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const onUnlock = () => {
      load();
      // Auto-expand when a new achievement unlocks so user sees it
      setCollapsed(false);
      try { localStorage.setItem(COLLAPSE_KEY, '0'); } catch {}
    };
    window.addEventListener('achievement:refresh', onUnlock);
    return () => window.removeEventListener('achievement:refresh', onUnlock);
  }, []);

  if (loading || !data) return null;

  const pct = (data.unlockedCount / data.totalCount) * 100;

  return (
    <div className="card p-5">
      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center justify-between gap-4 -m-1 p-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors text-left"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('achievements.title')}</h3>
            <p className="text-xs text-gray-500">{data.unlockedCount} {t('achievements.of')} {data.totalCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-32 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {!collapsed && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
          {data.achievements.map((a) => {
            const Icon = ICONS[a.icon] || Trophy;
            return (
              <div
                key={a.code}
                title={`${a.title}${a.description ? ' — ' + a.description : ''}${a.unlocked && a.achievedAt ? '\n' + new Date(a.achievedAt).toLocaleDateString('uk-UA') : ''}`}
                className={`group relative aspect-square rounded-xl flex flex-col items-center justify-center p-2 transition-all ${
                  a.unlocked
                    ? 'bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/30 border border-amber-200 dark:border-amber-800/50 hover:shadow-md hover:-translate-y-0.5'
                    : 'bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 opacity-60'
                }`}
              >
                {a.unlocked ? (
                  <Icon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Lock className="w-4 h-4 text-gray-400" />
                )}
                <span className={`text-[10px] mt-1 text-center leading-tight ${a.unlocked ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-400'}`}>
                  {a.title}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
