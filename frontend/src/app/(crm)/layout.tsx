'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import SearchPalette from '@/components/SearchPalette';
import { CelebrationListener } from '@/components/CelebrationListener';
import { WelcomeTour } from '@/components/WelcomeTour';
import { BrandingApplier } from '@/components/BrandingApplier';
import api from '@/lib/api';

// Один переиспользуемый AudioContext на вкладку: раньше каждый новый заказ создавал
// свой контекст, а браузер лимитирует их (~6) — после нескольких заказов new AudioContext()
// бросал исключение и звук молча пропадал.
let sharedAudioCtx: AudioContext | null = null;

function playChime() {
  try {
    if (!sharedAudioCtx) sharedAudioCtx = new AudioContext();
    const ctx = sharedAudioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const notes = [880, 1108]; // A5 → C#6
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
  } catch {}
}

// Зеркало ролей из Sidebar navItems (components/layout/Sidebar.tsx).
// UX-гард: бэкенд проверяет роли сам, здесь только редирект для UI.
const ROUTE_ROLES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/analytics/cc-payroll', roles: ['ADMIN'] },
  { prefix: '/analytics', roles: ['ADMIN', 'MANAGER'] },
  { prefix: '/goals', roles: ['ADMIN', 'MANAGER'] },
  { prefix: '/settings', roles: ['ADMIN'] },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, _hasHydrated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  // zustand persist регидратируется из localStorage синхронно, поэтому на первом
  // клиентском рендере _hasHydrated/user уже заполнены и расходятся с SSR (спиннер) →
  // hydration mismatch. mounted стартует false и на сервере, и на первом клиентском
  // рендере — они совпадают; настоящий гейт включается только после mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Load sound preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('crm_sound');
    if (stored === 'false') setSoundEnabled(false);
  }, []);

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('crm_sound', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!user) {
      router.replace('/login');
    } else if (user.role === 'CALL_CENTER') {
      router.replace('/cc');
    } else {
      // Страницы, скрытые в Sidebar по ролям, недоступны и по прямому URL
      const path = pathname ?? '';
      const rule = ROUTE_ROLES.find((r) => path.startsWith(r.prefix));
      if (rule && !rule.roles.includes(user.role)) {
        router.replace('/dashboard');
      }
    }
  }, [user, _hasHydrated, pathname, router]);

  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      try {
        const res = await api.get('/notifications', { params: { unreadOnly: true, limit: 1 } });
        setUnreadCount(res.data.unreadCount || 0);
      } catch {}
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);

    window.addEventListener('notifications:refresh', fetchUnread);

    // SSE: обновляем бейдж и дашборд при новом заказе на ЛЮБОЙ странице
    let es: EventSource | null = null;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectSse = async () => {
      const token = localStorage.getItem('crm_token');
      if (!token || cancelled) return;
      // Подключаемся напрямую к бэкенду — Next.js proxy буферизует SSE
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      // Короткоживущий ticket вместо 7-дневного JWT в URL (URL попадает в логи сервера)
      let sseUrl: string;
      try {
        const res = await api.post('/events/ticket');
        sseUrl = `${backendUrl}/api/events?ticket=${encodeURIComponent(res.data.ticket)}`;
      } catch {
        // Фолбэк: старый бэкенд без /events/ticket — подключаемся по-старому
        sseUrl = `${backendUrl}/api/events?token=${token}`;
      }
      if (cancelled) return;
      es = new EventSource(sseUrl);
      es.addEventListener('new_order', () => {
        fetchUnread();
        window.dispatchEvent(new CustomEvent('dashboard:refresh'));
        if (soundEnabledRef.current) playChime();
      });
      es.addEventListener('order_delivered', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data || '{}');
          window.dispatchEvent(new CustomEvent('celebrate', {
            detail: { type: 'order_delivered', message: `🎉 Заказ #${data.orderNum ?? ''} доставлено!` },
          }));
        } catch {}
        window.dispatchEvent(new CustomEvent('dashboard:refresh'));
      });
      es.addEventListener('milestone', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data || '{}');
          window.dispatchEvent(new CustomEvent('celebrate', {
            detail: { type: 'milestone', message: data.message || '🎉 Нова досягнення!' },
          }));
        } catch {}
      });
      es.addEventListener('achievement_unlocked', (ev) => {
        try {
          const a = JSON.parse((ev as MessageEvent).data || '{}');
          window.dispatchEvent(new CustomEvent('celebrate', {
            detail: { type: 'milestone', message: `🏆 ${a.title}${a.description ? ' — ' + a.description : ''}` },
          }));
          window.dispatchEvent(new CustomEvent('achievement:refresh'));
        } catch {}
      });
      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;
        // Переподключаемся со СВЕЖИМ ticket — старый живёт только 60 секунд
        reconnectTimer = setTimeout(connectSse, 5000);
      };
    };

    connectSse();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(interval);
      window.removeEventListener('notifications:refresh', fetchUnread);
      es?.close();
    };
  }, [user]);

  if (!mounted || !_hasHydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        unreadNotifications={unreadCount}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          soundEnabled={soundEnabled}
          onSoundToggle={toggleSound}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      <SearchPalette />
      <CelebrationListener />
      <WelcomeTour />
      <BrandingApplier />
    </div>
  );
}
