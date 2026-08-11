import Link from 'next/link';
import { Bus, Calendar } from 'lucide-react';
import { SearchFilterRail, SearchToolbar } from '@/components/search/SearchFilters';
import { OperatorTrustPanel } from '@/components/search/OperatorTrustPanel';
import { type TripFacets } from '@/lib/search';
import { type TripResult, type BoardingStop } from '@/lib/trips';
import { TripCard, type TripCardSize } from './TripCard';
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
  operator,
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
  operator?: { legalName: string; contactPhone: string };
}) {
  const showFilterRail =
    facets.operators.length > 1 ||
    facets.busTypes.length > 1 ||
    facets.windows.length > 1;

  // With one operator the filter rail is absent — fill the freed column with a
  // real operator/trust panel so the page never collapses to a lonely card.
  const showTrustPanel = !showFilterRail && operator != null;

  const cardSize: TripCardSize = totalBeforeFilters < 6 ? 'expanded' : 'default';

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

  // One card per boarding point of each trip (single bus, staggered pickups → a
  // rider picks their own pickup point). Trips without a schedule → one plain card.
  const items = trips.flatMap((trip) =>
    trip.boardingSchedule.length > 0
      ? trip.boardingSchedule.map((stop, i) => ({ trip, stop, key: `${trip.tripId}-${i}` }))
      : [{ trip, stop: undefined as BoardingStop | undefined, key: trip.tripId }],
  );
  const itemNoun = trips.some((t) => t.boardingSchedule.length > 0) ? 'điểm đón' : 'chuyến xe';

  return (
    <div
      className={
        showFilterRail
          ? 'md:grid md:grid-cols-[16rem_1fr] md:gap-6'
          : showTrustPanel
            ? 'md:grid md:grid-cols-[1fr_16rem] md:gap-6'
            : ''
      }
    >
      {showFilterRail && <SearchFilterRail facets={facets} />}

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 shadow-e1">
          {showPrev ? (
            <Link
              href={buildUrl(prevDate)}
              className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-destructive bg-white px-4 text-sm font-semibold text-destructive shadow-e1 transition-colors hover:bg-destructive hover:text-white"
              aria-label={`Ngày trước: ${formatVnDate(prevDate)}`}
            >
              ← Trước
            </Link>
          ) : (
            <span
              className="inline-flex min-h-10 cursor-not-allowed items-center justify-center gap-1 rounded-lg border border-border/50 bg-muted/30 px-4 text-sm font-medium text-muted-foreground/40"
              aria-disabled="true"
              aria-label="Không thể chọn ngày trong quá khứ"
            >
              ← Trước
            </span>
          )}
          <span className="flex-1 text-center text-sm font-semibold">
            {formatVnDate(date)}
          </span>
          <Link
            href={buildUrl(nextDate)}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-destructive bg-white px-4 text-sm font-semibold text-destructive shadow-e1 transition-colors hover:bg-destructive hover:text-white"
            aria-label={`Ngày sau: ${formatVnDate(nextDate)}`}
          >
            Sau →
          </Link>
        </div>

        <SearchToolbar facets={facets} showFilterSheet={showFilterRail} />

        {/* Heading danh sách: chip nhận diện + tiêu đề + ngày & số lượng, gờ phân cách nối vào danh sách thẻ */}
        <div className="-mb-2 flex items-center gap-3 border-b border-border pb-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Bus className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">Các chuyến xe hôm nay</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                <Calendar className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {formatVnDate(date)}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary-strong"
                aria-live="polite"
              >
                Hiển thị <strong className="font-bold">{items.length}</strong> {itemNoun}
              </span>
            </div>
          </div>
        </div>

        {trips.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            Không có chuyến nào khớp bộ lọc. Hãy bỏ bớt bộ lọc.
          </p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label={`${items.length} ${itemNoun}`}>
            {items.map(({ trip, stop, key }) => (
              <li key={key}>
                <TripCard
                  trip={trip}
                  ticketCount={ticketCount}
                  size={stop ? 'default' : cardSize}
                  boardingStop={stop}
                />
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

      {showTrustPanel && operator && (
        <OperatorTrustPanel
          operatorLegalName={operator.legalName}
          operatorContactPhone={operator.contactPhone}
        />
      )}
    </div>
  );
}
