'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { Phone, LogOut, Zap, Bell, Volume2, VolumeX, BarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext();
  return _audioCtx;
}

function playChime() {
  try {
    const ctx = getAudioCtx();
    const play = () => {
      const notes = [880, 1108];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.45);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.45);
      });
    };
    if (ctx.state === 'suspended') {
      ctx.resume().then(play);
    } else {
      play();
    }
  } catch {}
}

export default function CcLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, _hasHydrated, logout } = useAuthStore();
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  // Default OFF — first click on the icon enables sound AND unlocks AudioContext
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Always start muted — user must click the icon to unlock AudioContext and enable sound
  useEffect(() => {
    localStorage.removeItem('crm_sound');
  }, []);

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('crm_sound', String(next));
      // Unlock AudioContext when user enables sound (happens during click = user gesture)
      if (next) {
        try {
          const ctx = getAudioCtx();
          ctx.resume().then(() => playChime());
        } catch {}
      }
      return next;
    });
  };

  // Fetch real count of NEW orders from DB
  const fetchNewCount = useCallback(async () => {
    try {
      const res = await api.get('/orders', { params: { status: 'NEW', limit: 1 } });
      setNewOrdersCount(res.data.pagination.total ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!user) {
      router.replace('/login');
    } else if (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN') {
      router.replace('/dashboard');
    }
  }, [user, _hasHydrated, router]);

  useEffect(() => {
    if (!user) return;

    fetchNewCount();
    window.addEventListener('cc:status_changed', fetchNewCount);

    const token = localStorage.getItem('crm_token');
    if (!token) return;

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const es = new EventSource(`${backendUrl}/api/events?token=${token}`);

    es.addEventListener('new_order', (e: MessageEvent) => {
      let orderNum = '';
      try {
        const data = JSON.parse(e.data);
        orderNum = data.orderNum ? ` #${data.orderNum}` : '';
      } catch {}

      if (soundEnabledRef.current) playChime();

      toast.success(`Новый заказ${orderNum}!`, {
        duration: 6000,
        icon: '📦',
        style: { fontWeight: '600' },
      });

      fetchNewCount();
      window.dispatchEvent(new CustomEvent('cc:new_order'));
    });

    es.onerror = () => { es.close(); };

    return () => {
      window.removeEventListener('cc:status_changed', fetchNewCount);
      es.close();
    };
  }, [user, fetchNewCount]);

  if (!_hasHydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 dark:text-white">CRM Pro</span>
          <div className="flex items-center gap-1.5 ml-1 px-2.5 py-1 bg-teal-50 dark:bg-teal-900/20 rounded-full">
            <Phone className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span className="text-xs font-medium text-teal-700 dark:text-teal-400">Колл-центр</span>
          </div>

          {/* Nav tabs */}
          <nav className="flex items-center gap-1 ml-4">
            <Link
              href="/cc/orders"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                pathname === '/cc/orders' || pathname?.startsWith('/cc/orders/')
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Заказы</span>
            </Link>
            <Link
              href="/cc/stats"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                pathname === '/cc/stats'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Статистика</span>
            </Link>
          </nav>

          <div className="flex-1" />

          {/* NEW orders badge */}
          {newOrdersCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium">
              <Bell className="w-4 h-4" />
              {newOrdersCount} новых
            </div>
          )}

          {/* Sound toggle */}
          <button
            onClick={toggleSound}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={soundEnabled ? 'Выключить звук' : 'Включить звук'}
          >
            {soundEnabled
              ? <Volume2 className="w-5 h-5" />
              : <VolumeX className="w-5 h-5 text-gray-300 dark:text-gray-600" />
            }
          </button>

          <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">{user.name}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>

      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
