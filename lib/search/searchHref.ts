/**
 * Build a homepage URL with search params that lands on the RESULTS listing.
 * The page's `searchParamsSchema` requires `date` + `ticketCount`; omitting them
 * shows the marketing homepage. We default `date` to today (VN) and
 * `ticketCount` to 1. Stale (past) dates are auto-redirected to today.
 *
 * `new Date()` lives in this module-scope helper (not a component render body),
 * keeping RSC consumers `react-hooks/purity`-clean.
 */

/** Today in Asia/Ho_Chi_Minh as YYYY-MM-DD. */
export function todayVN(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export function searchHref(
  origin: string,
  destination: string,
  filters?: Record<string, string>,
): string {
  return `/?${new URLSearchParams({
    origin,
    destination,
    date: todayVN(),
    ticketCount: '1',
    ...filters,
  }).toString()}`;
}
