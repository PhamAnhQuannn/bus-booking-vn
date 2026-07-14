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
    // Store uses skipHydration (SSR-safe). If URL params are present (initialValues),
    // they are authoritative — seed the store directly and skip the async rehydrate
    // to avoid the gap where user typing could be clobbered by a late-arriving
    // localStorage value. Otherwise (hero page, no URL params), rehydrate from
    // localStorage AFTER mount for AC-5 back-nav restoration.
    void (async () => {
      if (initialValues) {
        setQuery(initialValues);
      } else {
        await useSearchStore.persist.rehydrate();
      }
      const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
      const { date, setDate } = useSearchStore.getState();
      if (date && date < todayVN) setDate(todayVN);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialValues)]);

  return <SearchForm places={places} />;
}
