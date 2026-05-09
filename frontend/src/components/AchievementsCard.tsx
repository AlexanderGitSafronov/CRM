'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Sparkles, Trophy, Award, Crown, PackageCheck, Truck,
  TrendingUp, DollarSign, Coins, Package, Users, Lock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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

export default function AchievementsCard() {
  const [data, setData] = useState<{ achievements: Achievement[]; unlockedCount: number; totalCount: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get('/achievements');
      setData(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const onUnlock = () => load();
    window.addEventListener('achievement:refresh', onUnlock);
    return () => window.removeEventListener('achievement:refresh', onUnlock);
  }, []);

  if (loading || !data) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Досягнення</h3>
            <p className="text-xs text-gray-500">{data.unlockedCount} з {data.totalCount}</p>
          </div>
        </div>
        <div className="w-32 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
            style={{ width: `${(data.unlockedCount / data.totalCount) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
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
    </div>
  );
}
