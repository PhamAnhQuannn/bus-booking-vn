/**
 * /search → permanent redirect to /.
 *
 * Search results now render on the homepage. This redirect preserves
 * backward compatibility for bookmarks, shared links, and external refs.
 */

import { permanentRedirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SearchRedirect({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') query.set(k, v);
  }
  const qs = query.toString();
  permanentRedirect(qs ? `/?${qs}` : '/');
}
