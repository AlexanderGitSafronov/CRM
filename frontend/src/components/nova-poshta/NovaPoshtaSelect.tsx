'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Search, MapPin, Package, ChevronDown, X, Loader2, Building2 } from 'lucide-react';

interface NpCity {
  ref: string;
  settlementRef: string;
  label: string;
}

interface NpWarehouse {
  ref: string;
  label: string;
  shortAddress: string;
  number: string;
  isPostomat: boolean;
}

interface Props {
  cityValue: string;
  addressValue: string;
  onCityChange: (city: string) => void;
  onAddressChange: (address: string) => void;
}

export default function NovaPoshtaSelect({ cityValue, addressValue, onCityChange, onAddressChange }: Props) {
  // City autocomplete
  const [cityQuery, setCityQuery] = useState(cityValue);
  const [cities, setCities] = useState<NpCity[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [selectedCity, setSelectedCity] = useState<NpCity | null>(null);

  // Warehouse search
  const [warehouseQuery, setWarehouseQuery] = useState('');
  const [warehouses, setWarehouses] = useState<NpWarehouse[]>([]);
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);

  const cityRef = useRef<HTMLDivElement>(null);
  const warehouseRef = useRef<HTMLDivElement>(null);
  const cityDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warehouseDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setShowCityDropdown(false);
      }
      if (warehouseRef.current && !warehouseRef.current.contains(e.target as Node)) {
        setShowWarehouseDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // City search with debounce
  useEffect(() => {
    if (cityDebounce.current) clearTimeout(cityDebounce.current);
    if (cityQuery.length < 2) {
      setCities([]);
      setShowCityDropdown(false);
      return;
    }
    // Don't re-search if user already selected a city matching the query
    if (selectedCity && selectedCity.label === cityQuery) return;

    cityDebounce.current = setTimeout(async () => {
      setCityLoading(true);
      try {
        const res = await api.get('/nova-poshta/cities', { params: { q: cityQuery } });
        setCities(res.data.data ?? []);
        setShowCityDropdown(true);
      } catch {
        setCities([]);
      } finally {
        setCityLoading(false);
      }
    }, 350);
  }, [cityQuery, selectedCity]);

  // Load warehouses when city is selected
  const loadWarehouses = useCallback(async (city: NpCity, search = '') => {
    setWarehouseLoading(true);
    try {
      const params: Record<string, string> = { cityRef: city.ref };
      if (search.trim()) params.q = search.trim();
      const res = await api.get('/nova-poshta/warehouses', { params });
      setWarehouses(res.data.data ?? []);
    } catch {
      setWarehouses([]);
    } finally {
      setWarehouseLoading(false);
    }
  }, []);

  // Warehouse search with debounce
  useEffect(() => {
    if (!selectedCity) return;
    if (warehouseDebounce.current) clearTimeout(warehouseDebounce.current);
    warehouseDebounce.current = setTimeout(() => {
      loadWarehouses(selectedCity, warehouseQuery);
    }, 350);
  }, [warehouseQuery, selectedCity, loadWarehouses]);

  const handleCitySelect = (city: NpCity) => {
    setSelectedCity(city);
    setCityQuery(city.label);
    setShowCityDropdown(false);
    onCityChange(city.label);
    // Reset warehouse
    setWarehouseQuery('');
    setWarehouses([]);
    onAddressChange('');
    // Load warehouses immediately
    loadWarehouses(city, '');
  };

  const handleWarehouseSelect = (w: NpWarehouse) => {
    onAddressChange(w.label);
    setWarehouseQuery(w.label);
    setShowWarehouseDropdown(false);
  };

  const clearCity = () => {
    setSelectedCity(null);
    setCityQuery('');
    setCities([]);
    setWarehouses([]);
    setWarehouseQuery('');
    onCityChange('');
    onAddressChange('');
  };

  // Sync external changes (e.g. when order loads)
  useEffect(() => {
    if (cityValue && cityValue !== cityQuery) {
      setCityQuery(cityValue);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityValue]);

  useEffect(() => {
    if (addressValue && addressValue !== warehouseQuery) {
      setWarehouseQuery(addressValue);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressValue]);

  return (
    <div className="space-y-2">
      {/* City search */}
      <div ref={cityRef} className="relative">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={cityQuery}
            onChange={(e) => {
              setCityQuery(e.target.value);
              if (selectedCity) setSelectedCity(null);
            }}
            onFocus={() => {
              if (cities.length > 0) setShowCityDropdown(true);
            }}
            placeholder="Пошук міста..."
            className="input w-full pl-9 pr-9"
            autoComplete="off"
          />
          {cityLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
          )}
          {selectedCity && !cityLoading && (
            <button
              type="button"
              onClick={clearCity}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {showCityDropdown && cities.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
            {cities.map((city) => (
              <button
                key={city.ref}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleCitySelect(city)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-0"
              >
                <span className="font-medium text-gray-900 dark:text-white">{city.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Warehouse picker — shown only after city selected */}
      {selectedCity && (
        <div ref={warehouseRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={warehouseQuery}
              onChange={(e) => {
                setWarehouseQuery(e.target.value);
                setShowWarehouseDropdown(true);
              }}
              onFocus={() => setShowWarehouseDropdown(true)}
              placeholder="Відділення або Поштомат..."
              className="input w-full pl-9 pr-9"
              autoComplete="off"
            />
            {warehouseLoading ? (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            ) : (
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            )}
          </div>

          {showWarehouseDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
              {warehouseLoading && warehouses.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400 text-center">Завантаження...</div>
              ) : warehouses.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400 text-center">Відділень не знайдено</div>
              ) : (
                warehouses.map((w) => (
                  <button
                    key={w.ref}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleWarehouseSelect(w)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-0',
                      warehouseQuery === w.label && 'bg-primary-50 dark:bg-primary-900/20'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {w.isPostomat
                        ? <Package className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        : <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      }
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {w.isPostomat ? 'Поштомат' : 'Відділення'} №{w.number}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate pl-5">{w.shortAddress}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
