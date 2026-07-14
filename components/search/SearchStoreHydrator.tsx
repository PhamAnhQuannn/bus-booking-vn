'use client';

/**
 * SearchStoreHydrator — writes the current search query into searchStore on mount.
 *
 * The /search results path is an RSC that never touches the client store, so
 * back-nav to "/" would otherwise show an empty form. Rendering this on the
 * valid-results path seeds the store (AC-5) without making the page a client
 * component. Renders nothing.
 *
 * Intentionally does NOT call useSearchStore.persist.rehydrate() — URL params
 * are the authoritative source on the results page; localStorage values are
 * irrelevant and would cause a flash. Contrast with SearchFormWrapper (hero
 * page), which DOES rehydrate() first for back-nav restoration.
 *
 * The `hydrated` ref ensures setQuery fires exactly once per mount even if
 * the parent RSC re-renders (streaming Suspense) or React Strict Mode double-invokes.
 */

import { useEffect, useRef } from 'react';
import { useSearchStore } from '@/lib/stores';
import type { SearchQuery } from '@/lib/stores';

export function SearchStoreHydrator({ query }: { query: SearchQuery }) {
  const setQuery = useSearchStore((s) => s.setQuery);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    setQuery(query);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
