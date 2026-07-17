/**
 * Zustand store for trip search query persistence.
 *
 * Persists to localStorage under key 'bbvn-search-query' so the back-nav
 * flow can restore the last search form state (AC-5, AC-6).
 *
 * Shape mirrors searchParamsSchema fields:
 *   origin, destination, date (YYYY-MM-DD), ticketCount (number 1–10)
 *
 * Usage:
 *   const { origin, setOrigin, ... } = useSearchStore();
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface SearchQuery {
  origin: string;
  destination: string;
  date: string;
  ticketCount: number;
}

interface SearchStore extends SearchQuery {
  setOrigin: (v: string) => void;
  setDestination: (v: string) => void;
  setDate: (v: string) => void;
  setTicketCount: (v: number) => void;
  setQuery: (q: Partial<SearchQuery>) => void;
  reset: () => void;
}

const DEFAULT_STATE: SearchQuery = {
  origin: '',
  destination: '',
  date: '',
  ticketCount: 1,
};

export const useSearchStore = create<SearchStore>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,

      setOrigin: (v) => set({ origin: v }),
      setDestination: (v) => set({ destination: v }),
      setDate: (v) => set({ date: v }),
      setTicketCount: (v) => set({ ticketCount: v }),

      setQuery: (q) => set((state) => ({ ...state, ...q })),

      reset: () => set(DEFAULT_STATE),
    }),
    {
      name: 'bbvn-search-query',
      storage: createJSONStorage(() => localStorage),
      // SSR-safe: do NOT rehydrate synchronously on store creation, or the first
      // client render (persisted values) would diverge from the server render
      // (empty DEFAULT_STATE) and throw a hydration mismatch. Consumers call
      // useSearchStore.persist.rehydrate() in a mount effect instead.
      skipHydration: true,
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version === 0 && typeof state?.ticketCount === 'string') {
          return { ...state, ticketCount: Number(state.ticketCount) || 1 };
        }
        return state;
      },
      // Only persist the query fields, not the action functions
      partialize: (state) => ({
        origin: state.origin,
        destination: state.destination,
        date: state.date,
        ticketCount: state.ticketCount,
      }),
    }
  )
);
