'use client';

/**
 * SearchFormWrapper — pre-fills searchStore from URL values then renders SearchForm.
 *
 * Used on the /search page when query params are invalid/missing.
 * Ensures back-nav restores last search state (AC-5).
 */

import { useEffect } from 'react';
import { SearchForm } from './SearchForm';
import { useSearchStore } from '@/lib/stores/searchStore';
import type { SearchQuery } from '@/lib/stores/searchStore';

interface Props {
  initialValues?: Partial<SearchQuery>;
}

export function SearchFormWrapper({ initialValues }: Props) {
  const setQuery = useSearchStore((s) => s.setQuery);

  useEffect(() => {
    if (initialValues) {
      setQuery(initialValues);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <SearchForm />;
}
