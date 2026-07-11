import Link from 'next/link';
import { SearchFilterRail, SearchToolbar } from '@/components/search/SearchFilters';
import { type TripFacets } from '@/lib/search';
import { type TripResult } from '@/lib/trips';
import { TripCard } from './TripCard';
import { formatVnDate, shiftDate } from './search-utils';

export function ResultsList({
  trips,
  facets,
  totalBeforeFilters,
  origin,
  destination,
  date,
  ticketCount,
  showPrev,
  nextCursor,
  allParams,
}: {
  trips: TripResult[];
  facets: TripFacets;
  totalBeforeFilters: number;
  origin: string;
  destination: string;
  date: string;
  ticketCount: number;
  showPrev: boolean;
  nextCursor: string | null;
  allParams: Record<string, string | string[] | undefined>;
}) {
  const prevDate = shiftDate(date, -1);
  const nextDate = shiftDate(date, 1);

  function buildUrl(newDate: string) {
    const p = new URLSearchParams({
      origin,
      destination,
      date: newDate,
      ticketCount: String(ticketCount),
    });
    return `/?${p.toString()}`;
  }

  function buildPageUrl(cursor: string): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(allParams)) {
      if (k === 'cursor') continue;
      if (typeof v === 'string') p.set(k, v);
      else if (Array.isArray(v) && v[0] !== undefined) p.set(k, v[0]);
    }
    p.set('cursor', cursor);
    return `/?${p.toString()}`;
  }

  return (
    <div className="md:grid md:grid-cols-[16rem_1fr] md:gap-6">
      <SearchFilterRail facets={facets} />

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-e1">
          {showPrev ? (
            <Link
              href={buildUrl(prevDate)}
              className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Ngày trước: ${formatVnDate(prevDate)}`}
            >
              ← Trước
            </Link>
          ) : (
            <span
              className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground/40"
              aria-disabled="true"
              aria-label="Không thể chọn ngày trong quá khứ"
            >
              ← Trước
            </span>
          )}
          <span className="flex-1 text-center text-sm font-semibold leading-[2.75rem]">
            {formatVnDate(date)}
          </span>
          <Link
            href={buildUrl(nextDate)}
            className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Ngày sau: ${formatVnDate(nextDate)}`}
          >
            Sau →
          </Link>
        </div>

        <SearchToolbar facets={facets} />

        <p className="text-sm text-muted-foreground" aria-live="polite">
          Hiển thị <strong className="text-foreground">{trips.length}</strong>
          {trips.length !== totalBeforeFilters ? `/${totalBeforeFilters}` : ''} chuyến xe
        </p>

        {trips.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            Không có chuyến nào khớp bộ lọc. Hãy bỏ bớt bộ lọc.
          </p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label={`${trips.length} chuyến xe`}>
            {trips.map((trip) => (
              <li key={trip.tripId}>
                <TripCard trip={trip} ticketCount={ticketCount} />
              </li>
            ))}
          </ul>
        )}

        {nextCursor ? (
          <div className="flex justify-center pt-2">
            <Link
              href={buildPageUrl(nextCursor)}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-medium transition-colors hover:bg-muted"
              aria-label="Xem thêm chuyến xe (trang sau)"
            >
              Xem thêm chuyến →
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
