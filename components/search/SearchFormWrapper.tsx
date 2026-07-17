'use client';

/**
 * SearchFormWrapper — rehydrates searchStore from localStorage after mount,
 * then renders SearchForm. Used on the hero landing page so back-nav restores
 * the last search state (AC-5). Also clamps a stale persisted date forward
 * to today (VN) if the user returns after their last search date has passed.
 */

import { useEffect } from 'react';
import { SearchForm } from './SearchForm';
import { useSearchStore } from '@/lib/stores';

interface Props {
  /** Bookable place names for the origin/destination typeahead suggestions. */
  places?: string[];
}

export function SearchFormWrapper({ places }: Props) {
  useEffect(() => {
    void (async () => {
      await useSearchStore.persist.rehydrate();
      const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
      const { date, setDate } = useSearchStore.getState();
      if (date && date < todayVN) setDate(todayVN);
    })();
  }, []);

  return <SearchForm places={places} />;
}
