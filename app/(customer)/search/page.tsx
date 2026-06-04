/**
 * /search — RSC trip search page.
 *
 * Reads URL searchParams → validates → queries DB via searchTrips() →
 * renders results or EmptyState with ±1-day navigation chips.
 *
 * AC-4: Results page displays all 7 contract fields in VN locale.
 * AC-5: Back button / chip navigation restores form state via searchStore.
 * AC-6: ±1-day date chips navigate to adjacent dates without re-entering form.
 */

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Armchair } from 'lucide-react';
import { searchParamsSchema, searchFiltersSchema } from '@/lib/core/validation/search';
import { track } from '@/lib/analytics';
import { searchTrips, SEARCH_PAGE_LIMIT, type TripResult } from '@/lib/trips/searchTrips';
import { applyTripFilters, type TripFacets } from '@/lib/search';
import { SearchFormWrapper } from '@/components/search/SearchFormWrapper';
import { SearchForm } from '@/components/search/SearchForm';
import { SearchStoreHydrator } from '@/components/search/SearchStoreHydrator';
import { SearchFilterRail, SearchToolbar } from '@/components/search/SearchFilters';
import { BookButton } from '@/components/search/BookButton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getSearchablePlaces } from '@/lib/places';

const BUS_TYPE_LABEL: Record<'coach' | 'sleeper' | 'limousine', string> = {
  coach: 'Ghế ngồi',
  sleeper: 'Giường nằm',
  limousine: 'Limousine',
};

export const metadata: Metadata = {
  title: 'Tìm chuyến xe | BBVN',
  description: 'Tìm và đặt vé xe khách',
};

// Force dynamic — never cache this page
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Format a YYYY-MM-DD string to Vietnamese date display */
function formatVnDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Shift a YYYY-MM-DD string by ±N days */
function shiftDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Format price in Vietnamese dong */
function formatPrice(price: number): string {
  return price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
}

/** Format ISO time to VN HH:MM */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

/** Arrival ISO = departure + duration. */
function arrivalIso(departIso: string, durationMinutes: number): string {
  return new Date(new Date(departIso).getTime() + durationMinutes * 60000).toISOString();
}

function durationLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h${m}` : `${h}h`;
}

function TripCard({ trip, ticketCount }: { trip: TripResult; ticketCount: number }) {
  const lowSeats = trip.availableSeats <= 5;
  return (
    <article
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-e1 transition-all hover:border-primary/30 hover:shadow-e2 motion-safe:hover:-translate-y-0.5"
      aria-label={`Chuyến từ ${trip.routeOrigin} đến ${trip.routeDestination}`}
    >
      {/* Operator + route */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <span>{trip.routeOrigin}</span>
          <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{trip.routeDestination}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
            aria-hidden="true"
          >
            {trip.operatorLegalName.replace(/^(Công ty|CÔNG TY)\s*/i, '').trim().charAt(0)}
          </span>
          <span className="text-sm text-muted-foreground">{trip.operatorLegalName}</span>
        </div>
      </div>

      {/* Depart → arrive + duration */}
      <div className="flex items-center gap-2 font-mono text-lg font-semibold">
        <span>{formatTime(trip.departureAt)}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {durationLabel(trip.durationMinutes)}
        </span>
        <span className="text-muted-foreground">→</span>
        <span>{formatTime(arrivalIso(trip.departureAt, trip.durationMinutes))}</span>
      </div>

      {/* Badges: bus type + seats-left urgency */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{BUS_TYPE_LABEL[trip.busType]}</Badge>
        <Badge variant={lowSeats ? 'pending' : 'neutral'}>
          <Armchair className="size-3.5" aria-hidden="true" />
          {lowSeats ? `Chỉ còn ${trip.availableSeats} chỗ` : `Còn ${trip.availableSeats} chỗ`}
        </Badge>
      </div>

      {/* Price + actions */}
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Giá vé</span>
          <span className="font-mono text-xl font-bold text-primary">{formatPrice(trip.price)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/trips/${trip.tripId}`}
            className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Xem chi tiết
          </Link>
          <BookButton tripId={trip.tripId} ticketCount={ticketCount} />
        </div>
      </div>
    </article>
  );
}

function EmptyState({
  origin,
  destination,
  date,
  ticketCount,
  showPrev,
}: {
  origin: string;
  destination: string;
  date: string;
  ticketCount: string;
  showPrev: boolean;
}) {
  const prevDate = shiftDate(date, -1);
  const nextDate = shiftDate(date, 1);

  function buildUrl(newDate: string) {
    const p = new URLSearchParams({ origin, destination, date: newDate, ticketCount });
    return `/search?${p.toString()}`;
  }

  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <p className="text-lg text-muted-foreground">
        Không tìm thấy chuyến xe cho ngày này.
      </p>
      <p className="text-sm text-muted-foreground">Thử ngày khác:</p>
      <div className="flex gap-3">
        {showPrev ? (
          <Link
            href={buildUrl(prevDate)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
            aria-label={`Tìm ngày trước: ${formatVnDate(prevDate)}`}
          >
            ← {formatVnDate(prevDate)}
          </Link>
        ) : (
          <span
            className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-lg border border-border bg-muted/40 px-4 text-sm font-medium text-muted-foreground/40"
            aria-disabled="true"
            aria-label="Không thể chọn ngày trong quá khứ"
          >
            ← {formatVnDate(prevDate)}
          </span>
        )}
        <Link
          href={buildUrl(nextDate)}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
          aria-label={`Tìm ngày sau: ${formatVnDate(nextDate)}`}
        >
          {formatVnDate(nextDate)} →
        </Link>
      </div>
    </div>
  );
}

function ResultsList({
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
  /** Issue 097: opaque seek cursor for the next page, or null on the last page. */
  nextCursor: string | null;
  /** All current URL params (origin/dest/date/filters/sort) to preserve when paging. */
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
    return `/search?${p.toString()}`;
  }

  // Issue 097: next-page link preserves EVERY current query param (origin/dest/
  // date/ticketCount + active filters + sort) and swaps in the new cursor. A
  // fresh date-chip navigation drops the cursor by rebuilding from scratch above,
  // so changing the date resets paging to page 1 (correct — a new result set).
  function buildPageUrl(cursor: string): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(allParams)) {
      if (k === 'cursor') continue; // replaced below
      if (typeof v === 'string') p.set(k, v);
      else if (Array.isArray(v) && v[0] !== undefined) p.set(k, v[0]);
    }
    p.set('cursor', cursor);
    return `/search?${p.toString()}`;
  }

  return (
    <div className="md:grid md:grid-cols-[16rem_1fr] md:gap-6">
      {/* PTN-03: persistent sticky filter rail (desktop) */}
      <SearchFilterRail facets={facets} />

      <div className="flex min-w-0 flex-col gap-4">
        {/* ±1 day nav — segmented bar; prev hidden when date == today (VN) */}
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

        {/* Sort + active-filter chips + mobile filter button */}
        <SearchToolbar facets={facets} />

        {/* Result count (reflects active filters) */}
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Hiển thị <strong className="text-foreground">{trips.length}</strong>
          {trips.length !== totalBeforeFilters ? `/${totalBeforeFilters}` : ''} chuyến xe
        </p>

        {/* Trip cards, or filtered-empty notice */}
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

        {/* Issue 097: seek-pagination next-page control. Present only when the
            base set has more rows past this page. Links to the same URL with the
            opaque cursor appended (share/refresh-safe). */}
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

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Extract raw string values
  const raw = {
    origin: typeof params.origin === 'string' ? params.origin : '',
    destination: typeof params.destination === 'string' ? params.destination : '',
    date: typeof params.date === 'string' ? params.date : '',
    ticketCount: typeof params.ticketCount === 'string' ? params.ticketCount : '',
  };

  const parsed = searchParamsSchema.safeParse(raw);

  // If no valid params, show the search form
  if (!parsed.success) {
    const places = await getSearchablePlaces();
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-8">
        <h1 className="text-2xl font-bold">Tìm chuyến xe</h1>
        <SearchFormWrapper initialValues={raw} places={places} />
      </main>
    );
  }

  const { origin, destination, date, ticketCount } = parsed.data;

  // Today in Asia/Ho_Chi_Minh (en-CA → YYYY-MM-DD; lexical order == chronological).
  // Past dates aren't browsable: a stale URL/bookmark with date < today is
  // redirected forward to today (origin/destination/ticketCount preserved).
  const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  if (date < todayVN) {
    const p = new URLSearchParams({ origin, destination, date: todayVN, ticketCount: String(ticketCount) });
    redirect(`/search?${p.toString()}`);
  }

  // Issue 097: cursor/seek pagination. The cursor rides the URL (source of truth)
  // so share/refresh preserves position. `searchTrips` materialises the FULL
  // availability-resolved base set for facets (page-independent) — pass a very
  // large limit so the base call is never truncated — then a SECOND bounded call
  // returns just this page's rows via the (departureAt, id) seek cursor.
  const cursor = typeof params.cursor === 'string' ? params.cursor : null;

  const [base, page] = await Promise.all([
    // Facet base: full set, no cursor. (The allowed bounded full scan — see
    // searchTrips DESIGN note. Facets MUST reflect ALL matching trips, not a page.)
    searchTrips({ origin, destination, date, ticketCount, limit: Number.MAX_SAFE_INTEGER }),
    // Page rows: bounded seek window from the URL cursor.
    searchTrips({ origin, destination, date, ticketCount, cursor, limit: SEARCH_PAGE_LIMIT }),
  ]);
  const baseTrips = base.trips;
  const nextCursor = page.nextCursor;

  // Funnel top-step. The /search RSC calls searchTrips() in-process (never the
  // JSON API route), so search_performed must be fired here — fire-and-forget,
  // read bb_sid (httpOnly) server-side. No session on the first-ever request of
  // a new visitor (proxy mints bb_sid in the same response) → undercount by 1/session.
  const sessionId = (await cookies()).get('bb_sid')?.value ?? null;
  void track('search_performed', { sessionId, context: { resultCount: baseTrips.length } });

  // Layer optional filters/sort. Facets are derived from the UNFILTERED FULL base
  // set (page-independent); the displayed trips are this page's seek window, with
  // the same filters/sort applied for display.
  const filterParams = searchFiltersSchema.safeParse(params);
  const activeFilters = filterParams.success ? filterParams.data : searchFiltersSchema.parse({});
  const { facets, totalBeforeFilters } = applyTripFilters(baseTrips, activeFilters);
  const { trips } = applyTripFilters(page.trips, activeFilters);

  // AC-4: suppress prev-day chip whenever the searched date is today or earlier
  // (Asia/Ho_Chi_Minh) — past dates aren't browsable, so prev can never go back
  // before today. `>` on YYYY-MM-DD strings is chronological.
  const showPrev = date > todayVN;

  // Places for the inline "edit search" form's origin/destination comboboxes.
  const places = await getSearchablePlaces();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      {/* Seed searchStore so back-nav to "/" restores the form (AC-5) */}
      <SearchStoreHydrator
        query={{ origin, destination, date, ticketCount: String(ticketCount) }}
      />

      {/* Header + back to form */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          aria-label="Tìm lại — quay về trang tìm kiếm"
        >
          ← Tìm lại
        </Link>
        <h1 className="text-lg font-semibold">
          {origin} → {destination}
        </h1>
      </div>

      {/* Inline "edit search" — pre-filled from the seeded store; re-searches on submit. */}
      <Card className="shadow-e1">
        <CardContent className="py-3">
          <SearchForm places={places} orientation="horizontal" />
        </CardContent>
      </Card>

      {totalBeforeFilters === 0 ? (
        <EmptyState
          origin={origin}
          destination={destination}
          date={date}
          ticketCount={String(ticketCount)}
          showPrev={showPrev}
        />
      ) : (
        <ResultsList
          trips={trips}
          facets={facets}
          totalBeforeFilters={totalBeforeFilters}
          origin={origin}
          destination={destination}
          date={date}
          ticketCount={ticketCount}
          showPrev={showPrev}
          nextCursor={nextCursor}
          allParams={params}
        />
      )}
    </main>
  );
}
