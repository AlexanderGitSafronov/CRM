'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';

// Lightweight self-contained confetti (no external deps).
function fireConfetti() {
  if (typeof document === 'undefined') return;
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:100;overflow:hidden';
  document.body.appendChild(root);

  const colors = ['#3b82f6', '#a855f7', '#d946ef', '#f59e0b', '#10b981', '#ef4444'];
  const N = 90;
  for (let i = 0; i < N; i++) {
    const piece = document.createElement('div');
    const size = 6 + Math.random() * 8;
    const left = 50 + (Math.random() * 30 - 15);
    const dx = (Math.random() - 0.5) * 600;
    const duration = 1800 + Math.random() * 1400;
    const rotate = Math.random() * 720 - 360;
    const color = colors[Math.floor(Math.random() * colors.length)];
    piece.style.cssText = `
      position:absolute; top:-20px; left:${left}%;
      width:${size}px; height:${size * 1.4}px;
      background:${color}; border-radius:2px;
      transform:translate(0,0) rotate(0);
      opacity:1;
      transition: transform ${duration}ms cubic-bezier(.2,.8,.2,1), opacity ${duration}ms ease-out;
      will-change: transform, opacity;
    `;
    root.appendChild(piece);
    requestAnimationFrame(() => {
      piece.style.transform = `translate(${dx}px, ${window.innerHeight + 80}px) rotate(${rotate}deg)`;
      piece.style.opacity = '0';
    });
  }
  setTimeout(() => root.remove(), 3500);
}

export function CelebrationListener() {
  useEffect(() => {
    let lastDeliveredAt = 0;
    let lastMilestoneAt = 0;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type?: string; message?: string } | undefined;
      const t = detail?.type;
      if (!t) return;

      const now = Date.now();
      if (t === 'order_delivered' && now - lastDeliveredAt > 5000) {
        lastDeliveredAt = now;
        fireConfetti();
        toast.success(detail?.message || '🎉 Заказ доставлено!');
      } else if (t === 'milestone' && now - lastMilestoneAt > 5000) {
        lastMilestoneAt = now;
        fireConfetti();
        toast(detail?.message || '🎉 Нова досягнення!', { duration: 5000 });
      }
    };

    window.addEventListener('celebrate', handler as EventListener);
    return () => window.removeEventListener('celebrate', handler as EventListener);
  }, []);

  return null;
}
