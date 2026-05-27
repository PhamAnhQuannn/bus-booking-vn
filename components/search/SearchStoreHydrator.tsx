'use client';

/**
 * SearchStoreHydrator — writes the current search query into searchStore on mount.
 *
 * The /search results path is an RSC that never touches the client store, so
 * back-nav to "/" would otherwise show an empty form. Rendering this on the
 * valid-results path seeds the store (AC-5) without making the page a client
 * component. Renders nothing.
 */

import { useEffect } from 'react';
import { useSearchStore } from '@/lib/stores/searchStore';
import type { SearchQuery } from '@/lib/stores/searchStore';

export function SearchStoreHydrator({ query }: { query: SearchQuery }) {
  const setQuery = useSearchStore((s) => s.setQuery);

  useEffect(() => {
    setQuery(query);
  }, [query.origin, query.destination, query.date, query.ticketCount]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
