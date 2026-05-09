import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCallback } from 'react';
import { type Locale, DEFAULT_LOCALE, translate, type DictKey } from '@/lib/i18n';

interface LocaleState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'crm_locale' },
  ),
);

// Hook returns a translator function bound to the active locale.
export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  const t = useCallback(
    (key: DictKey | string) => translate(key, locale),
    [locale],
  );
  return t;
}
