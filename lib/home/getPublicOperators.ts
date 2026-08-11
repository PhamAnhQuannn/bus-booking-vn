import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/core/db/client';
import { SEARCH_VISIBLE_STATUSES } from '@/lib/onboarding';

export interface PublicOperator {
  id: string;
  brandName: string | null;
  legalName: string;
  provinceName: string | null;
  routesSummary: string | null;
  topRoute: { origin: string; destination: string } | null;
}

async function fetchPublicOperators(): Promise<PublicOperator[]> {
  const rows = await prisma.operator.findMany({
    where: {
      status: { in: SEARCH_VISIBLE_STATUSES },
      disabledAt: null,
      // Only operators with ≥1 bookable route — otherwise the homecard links nowhere.
      routes: { some: { deactivatedAt: null, moderatedAt: null } },
    },
    select: {
      id: true,
      brandName: true,
      legalName: true,
      provinceName: true,
      routesSummary: true,
      routes: {
        where: { deactivatedAt: null, moderatedAt: null },
        select: { origin: true, destination: true },
        take: 1,
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((r) => ({
    id: r.id,
    brandName: r.brandName,
    legalName: r.legalName,
    provinceName: r.provinceName,
    routesSummary: r.routesSummary,
    topRoute: r.routes[0] ?? null,
  }));
}

/**
 * Cached public catalog read (revalidate 300s, tag 'catalog'). Same policy as
 * getActiveRoutes: pure catalog metadata, no live seat/price, so a ≤5-min staleness
 * is fine. On-demand invalidation deliberately NOT wired — if ever needed, use the
 * Next 16 two-arg `revalidateTag('catalog', 'max')` / `updateTag('catalog')` from a
 * Route Handler (the bare single-arg form is deprecated). See getActiveRoutes.ts.
 */
export const getPublicOperators = unstable_cache(fetchPublicOperators, ['public-operators'], {
  tags: ['catalog'],
  revalidate: 300,
});
