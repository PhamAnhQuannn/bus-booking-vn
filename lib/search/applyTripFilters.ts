/**
 * Pure, in-memory filter + sort + facet derivation over a base trip result set.
 *
 * The DB query (searchTrips) returns every scheduled, bookable trip for the
 * origin/destination/date/ticketCount. This layer applies the optional client
 * filters and computes the facet options shown in the filter UI. Result sets per
 * route/date are small (no pagination), so in-memory is correct and avoids
 * timezone-sensitive SQL for the departure-window bucket.
 *
 * No DB access — unit-testable in isolation.
 */

import type { TripResult } from '@/lib/db/searchTrips';
import type { SearchFilters, BusType, TimeWindow } from '@/lib/validation/search';

const TZ = 'Asia/Ho_Chi_Minh';

/** Hour-of-day (0–23) of an ISO instant in Asia/Ho_Chi_Minh wall-clock. */
export function vnHour(iso: string): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
  return Number(h);
}

/** Which time-window bucket a VN-local hour falls into. */
export function windowOf(hour: number): TimeWindow {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night'; // 22:00–04:59
}

export interface TripFacets {
  operators: { id: string; legalName: string; count: number }[];
  busTypes: { value: BusType; count: number }[];
  windows: { value: TimeWindow; count: number }[];
  priceRange: { min: number; max: number } | null;
  durationRange: { min: number; max: number } | null;
}

export interface FilteredTrips {
  trips: TripResult[];
  facets: TripFacets;
  /** Count before filters (the base set size). */
  totalBeforeFilters: number;
}

/** Derive facet options + counts from the UNFILTERED base set. */
function deriveFacets(base: TripResult[]): TripFacets {
  const operatorMap = new Map<string, { legalName: string; count: number }>();
  const busTypeMap = new Map<BusType, number>();
  const windowMap = new Map<TimeWindow, number>();
  let priceMin = Infinity;
  let priceMax = -Infinity;
  let durMin = Infinity;
  let durMax = -Infinity;

  for (const t of base) {
    const op = operatorMap.get(t.operatorId);
    if (op) op.count += 1;
    else operatorMap.set(t.operatorId, { legalName: t.operatorLegalName, count: 1 });

    busTypeMap.set(t.busType, (busTypeMap.get(t.busType) ?? 0) + 1);

    const w = windowOf(vnHour(t.departureAt));
    windowMap.set(w, (windowMap.get(w) ?? 0) + 1);

    if (t.price < priceMin) priceMin = t.price;
    if (t.price > priceMax) priceMax = t.price;
    if (t.durationMinutes < durMin) durMin = t.durationMinutes;
    if (t.durationMinutes > durMax) durMax = t.durationMinutes;
  }

  return {
    operators: [...operatorMap.entries()]
      .map(([id, v]) => ({ id, legalName: v.legalName, count: v.count }))
      .sort((a, b) => a.legalName.localeCompare(b.legalName, 'vi')),
    busTypes: [...busTypeMap.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    windows: [...windowMap.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    priceRange: base.length ? { min: priceMin, max: priceMax } : null,
    durationRange: base.length ? { min: durMin, max: durMax } : null,
  };
}

const SORTERS: Record<SearchFilters['sort'], (a: TripResult, b: TripResult) => number> = {
  departure_asc: (a, b) => a.departureAt.localeCompare(b.departureAt),
  price_asc: (a, b) => a.price - b.price || a.departureAt.localeCompare(b.departureAt),
  price_desc: (a, b) => b.price - a.price || a.departureAt.localeCompare(b.departureAt),
  duration_asc: (a, b) =>
    a.durationMinutes - b.durationMinutes || a.departureAt.localeCompare(b.departureAt),
};

/**
 * Apply filters then sort. Facets are always derived from the base set so the UI
 * keeps showing every available option even after a filter narrows the results.
 */
export function applyTripFilters(base: TripResult[], filters: SearchFilters): FilteredTrips {
  const facets = deriveFacets(base);

  let trips = base.filter((t) => {
    if (filters.operatorId && t.operatorId !== filters.operatorId) return false;
    if (filters.busType && filters.busType.length && !filters.busType.includes(t.busType))
      return false;
    if (filters.priceMin !== undefined && t.price < filters.priceMin) return false;
    if (filters.priceMax !== undefined && t.price > filters.priceMax) return false;
    if (filters.maxDurationMinutes !== undefined && t.durationMinutes > filters.maxDurationMinutes)
      return false;
    if (filters.window && windowOf(vnHour(t.departureAt)) !== filters.window) return false;
    return true;
  });

  trips = [...trips].sort(SORTERS[filters.sort]);

  return { trips, facets, totalBeforeFilters: base.length };
}
