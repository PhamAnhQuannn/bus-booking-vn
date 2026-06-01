/**
 * Build a /search URL that lands on the RESULTS listing (not the search form).
 * The page's `searchParamsSchema` requires `date` + `ticketCount`; omitting them
 * makes /search fall back to the form. We default `date` to today (VN) and
 * `ticketCount` to 1. Stale (past) dates are auto-redirected to today by /search.
 *
 * `new Date()` lives in this module-scope helper (not a component render body),
 * keeping RSC consumers `react-hooks/purity`-clean.
 */

/** Today in Asia/Ho_Chi_Minh as YYYY-MM-DD. */
export function todayVN(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export function searchHref(origin: string, destination: string): string {
  return `/search?${new URLSearchParams({
    origin,
    destination,
    date: todayVN(),
    ticketCount: '1',
  }).toString()}`;
}
