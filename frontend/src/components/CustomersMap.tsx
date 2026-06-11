'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { resolveCity } from '@/lib/uaCities';
import { MapPin, Loader2 } from 'lucide-react';

interface CityRow {
  city: string;
  orders: number;
  revenue: number;
}

export default function CustomersMap() {
  const [data, setData] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    api.get('/analytics/customers-by-city').then((r) => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || !containerRef.current || !data.length) return;
    if (mapRef.current) return; // already initialized

    let cancelled = false;
    (async () => {
      // Dynamic import — leaflet is browser-only
      const L = (await import('leaflet')).default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Lany: any = L;
      // Inject CSS via CDN since leaflet's CSS isn't auto-bundled
      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.setAttribute('data-leaflet-css', '1');
        document.head.appendChild(link);
      }
      // Style for the permanent order-count label sitting on each bubble
      if (!document.querySelector('style[data-om-label]')) {
        const style = document.createElement('style');
        style.setAttribute('data-om-label', '1');
        style.textContent =
          '.om-count-label{background:transparent;border:none;box-shadow:none;color:#fff;font-weight:700;font-size:11px;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,.45);padding:0;}.om-count-label:before{display:none!important;}';
        document.head.appendChild(style);
      }
      if (cancelled || !containerRef.current) return;

      const map = Lany.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([49.0, 31.5], 6);

      Lany.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18, subdomains: 'abcd',
      }).addTo(map);

      const aggregated = data
        .map((row) => {
          const c = resolveCity(row.city);
          return c ? { ...row, lat: c.lat, lng: c.lng, name: c.name } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      // Proportional symbols: circle AREA grows with order volume (so radius ~ √count),
      // in ABSOLUTE terms — 1 order is always a small dot, busy cities clearly stand out,
      // regardless of how the other cities compare. Color ramps cool→hot by absolute count.
      const radiusFor = (orders: number) =>
        Math.max(7, Math.min(34, 5 + Math.sqrt(orders) * 5.5));
      const styleFor = (orders: number) => {
        if (orders >= 25) return { fill: '#b91c1c', opacity: 0.82 }; // deep red
        if (orders >= 10) return { fill: '#ef4444', opacity: 0.74 }; // red
        if (orders >= 5) return { fill: '#f59e0b', opacity: 0.68 };  // amber
        if (orders >= 2) return { fill: '#fbbf24', opacity: 0.58 };  // light amber
        return { fill: '#60a5fa', opacity: 0.55 };                   // blue (1)
      };
      for (const a of aggregated) {
        const { fill, opacity } = styleFor(a.orders);
        const circle = Lany.circleMarker([a.lat, a.lng], {
          radius: radiusFor(a.orders),
          fillColor: fill,
          color: '#fff',
          weight: 1.5,
          fillOpacity: opacity,
        });
        // permanent count label centered on the bubble for at-a-glance reading
        circle.bindTooltip(String(a.orders), {
          permanent: true,
          direction: 'center',
          className: 'om-count-label',
        });
        circle.bindPopup(`<div style="font-family:system-ui;min-width:160px;">
          <div style="font-weight:600;margin-bottom:4px;">${a.name}</div>
          <div style="font-size:12px;color:#666;">Замовлень: <b>${a.orders}</b></div>
          <div style="font-size:12px;color:#666;">Виручка: <b>${Math.round(a.revenue).toLocaleString('uk-UA')} ₴</b></div>
        </div>`);
        circle.addTo(map);
      }
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
    };
  }, [data, loading]);

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="card p-8 text-center text-sm text-gray-400">
        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
        Поки що немає даних про міста
      </div>
    );
  }

  const top = data.slice(0, 5);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-rose-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Карта замовлень</h3>
        </div>
        <span className="text-xs text-gray-400">{data.length} міст</span>
      </div>
      <div className="relative">
        <div ref={containerRef} className="w-full h-80 bg-gray-50 dark:bg-gray-800/40" />
        <div className="pointer-events-none absolute bottom-2 right-2 z-[500] flex items-center gap-1.5 rounded-lg bg-white/85 dark:bg-gray-900/80 px-2.5 py-1.5 text-[10px] text-gray-500 dark:text-gray-300 shadow-sm backdrop-blur">
          <span>менше</span>
          <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: '#60a5fa' }} />
          <span className="inline-block rounded-full" style={{ width: 11, height: 11, background: '#fbbf24' }} />
          <span className="inline-block rounded-full" style={{ width: 14, height: 14, background: '#f59e0b' }} />
          <span className="inline-block rounded-full" style={{ width: 17, height: 17, background: '#ef4444' }} />
          <span className="inline-block rounded-full" style={{ width: 20, height: 20, background: '#b91c1c' }} />
          <span>більше замовлень</span>
        </div>
      </div>
      {top.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-5 border-t border-gray-100 dark:border-gray-800">
          {top.map((c, i) => (
            <div key={c.city} className={`p-3 text-center ${i > 0 ? 'sm:border-l border-gray-100 dark:border-gray-800' : ''}`}>
              <p className="text-xs text-gray-400">{c.city}</p>
              <p className="font-bold text-sm text-gray-900 dark:text-white">{c.orders}</p>
              <p className="text-[11px] text-gray-500">{Math.round(c.revenue).toLocaleString('uk-UA')} ₴</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
