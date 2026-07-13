'use client';

/**
 * SearchFormWrapper — pre-fills searchStore from URL values then renders SearchForm.
 *
 * Used on the /search page when query params are invalid/missing.
 * Ensures back-nav restores last search state (AC-5).
 */

import { useEffect } from 'react';
import { SearchForm } from './SearchForm';
import { useSearchStore } from '@/lib/stores';
import type { SearchQuery } from '@/lib/stores';

interface Props {
  initialValues?: Partial<SearchQuery>;
  /** Bookable place names for the origin/destination typeahead suggestions. */
  places?: string[];
}

export function SearchFormWrapper({ initialValues, places }: Props) {
  const setQuery = useSearchStore((s) => s.setQuery);

  useEffect(() => {
    // Store uses skipHydration (SSR-safe). Rehydrate from localStorage AFTER mount
    // so the first client render matches the server, then let URL values win.
    void (async () => {
      await useSearchStore.persist.rehydrate();
      if (initialValues) setQuery(initialValues);
      const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
      const { date, setDate } = useSearchStore.getState();
      if (date && date < todayVN) setDate(todayVN);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <SearchForm places={places} />;
}
