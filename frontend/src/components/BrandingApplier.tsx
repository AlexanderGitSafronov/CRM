'use client';

import { useEffect } from 'react';
import { useBrandingStore } from '@/stores/brandingStore';

// Convert hex like "#3b82f6" to rgb tuple
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function adjust(hex: string, delta: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.max(0, Math.min(255, rgb.r + delta));
  const g = Math.max(0, Math.min(255, rgb.g + delta));
  const b = Math.max(0, Math.min(255, rgb.b + delta));
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const STYLE_ID = 'crm-brand-style';

export function BrandingApplier() {
  const { branding, loaded, fetch } = useBrandingStore();

  useEffect(() => {
    if (!loaded) fetch();
  }, [loaded, fetch]);

  useEffect(() => {
    if (!branding?.primaryColor) {
      document.getElementById(STYLE_ID)?.remove();
      return;
    }
    const c = branding.primaryColor;
    const c700 = adjust(c, -25);
    const c500 = adjust(c, 20);
    const c50 = adjust(c, 200);
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    // Override the most-used Tailwind primary classes used across the app
    el.textContent = `
      .bg-primary-600 { background-color: ${c} !important; }
      .bg-primary-700, .hover\\:bg-primary-700:hover { background-color: ${c700} !important; }
      .bg-primary-500 { background-color: ${c500} !important; }
      .bg-primary-50 { background-color: ${c50} !important; }
      .text-primary-600 { color: ${c} !important; }
      .text-primary-700, .dark\\:text-primary-400 { color: ${c700} !important; }
      .border-primary-200, .border-primary-600 { border-color: ${c} !important; }
      .ring-primary-500 { --tw-ring-color: ${c} !important; }
      .focus\\:ring-primary-500:focus { --tw-ring-color: ${c} !important; }
    `;
    return () => { /* keep style across renders */ };
  }, [branding?.primaryColor]);

  return null;
}
