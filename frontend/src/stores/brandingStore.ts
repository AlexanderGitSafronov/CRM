import { create } from 'zustand';
import api from '@/lib/api';

interface Branding {
  name: string;
  logo: string | null;
  primaryColor: string | null;
}

interface BrandingState {
  branding: Branding | null;
  loaded: boolean;
  fetch: () => Promise<void>;
  set: (b: Partial<Branding>) => void;
}

export const useBrandingStore = create<BrandingState>((set) => ({
  branding: null,
  loaded: false,
  fetch: async () => {
    try {
      const res = await api.get('/organization/branding');
      set({ branding: res.data, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  set: (b) => set((state) => ({
    branding: { ...(state.branding || { name: '', logo: null, primaryColor: null }), ...b },
  })),
}));
