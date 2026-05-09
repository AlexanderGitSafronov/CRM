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

      const maxOrders = Math.max(...aggregated.map((a) => a.orders), 1);
      for (const a of aggregated) {
        const r = 8 + (a.orders / maxOrders) * 24;
        const intensity = a.orders / maxOrders;
        const fill = intensity > 0.66 ? '#dc2626' : intensity > 0.33 ? '#f59e0b' : '#3b82f6';
        const circle = Lany.circleMarker([a.lat, a.lng], {
          radius: r,
          fillColor: fill,
          color: '#fff',
          weight: 2,
          fillOpacity: 0.65,
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
      <div ref={containerRef} className="w-full h-80 bg-gray-50 dark:bg-gray-800/40" />
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
