'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import SearchPalette from '@/components/SearchPalette';
import { CelebrationListener } from '@/components/CelebrationListener';
import { WelcomeTour } from '@/components/WelcomeTour';
import api from '@/lib/api';

function playChime() {
  try {
    const ctx = new AudioContext();
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

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, _hasHydrated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

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
    }
  }, [user, _hasHydrated, router]);

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
    const token = localStorage.getItem('crm_token');
    let es: EventSource | null = null;
    if (token) {
      // Подключаемся напрямую к бэкенду — Next.js proxy буферизует SSE
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      es = new EventSource(`${backendUrl}/api/events?token=${token}`);
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
      es.onerror = () => { es?.close(); };
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('notifications:refresh', fetchUnread);
      es?.close();
    };
  }, [user]);

  if (!_hasHydrated || !user) {
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
    </div>
  );
}
