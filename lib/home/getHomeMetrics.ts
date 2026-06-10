/**
 * Home-page scale metrics for the trust strip. Real live counts — the UI
 * threshold-gates each number (shows it only above a floor, qualitative copy
 * below) so the page never claims scale it doesn't have (no fake-precise numbers).
 *
 * Three independent counts in one round-trip:
 *  - operators: search-visible (APPROVED, not disabled) operators
 *  - routes:    active, non-moderated routes
 *  - trips:     upcoming scheduled, sales-open trips
 */

import { prisma } from '@/lib/core/db/client';
import { SEARCH_VISIBLE_STATUSES } from '@/lib/onboarding';

export interface HomeMetrics {
  operators: number;
  routes: number;
  trips: number;
}

export async function getHomeMetrics(): Promise<HomeMetrics> {
  const now = new Date();
  const [operators, routes, trips] = await Promise.all([
    prisma.operator.count({
      where: { status: { in: SEARCH_VISIBLE_STATUSES }, disabledAt: null },
    }),
    prisma.route.count({ where: { deactivatedAt: null, moderatedAt: null } }),
    prisma.trip.count({
      where: { status: 'scheduled', salesClosed: false, departureAt: { gte: now } },
    }),
  ]);
  return { operators, routes, trips };
}
