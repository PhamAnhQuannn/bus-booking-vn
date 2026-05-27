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
import Link from 'next/link';
import { ArrowRight, Clock, Armchair } from 'lucide-react';
import { searchParamsSchema } from '@/lib/validation/search';
import { searchTrips, type TripResult } from '@/lib/db/searchTrips';
import { SearchFormWrapper } from '@/components/search/SearchFormWrapper';
import { SearchStoreHydrator } from '@/components/search/SearchStoreHydrator';
import { BookButton } from '@/components/search/BookButton';

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

/** Format ISO departure time to Vietnamese time display */
function formatDepartureAt(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function TripCard({ trip, ticketCount }: { trip: TripResult; ticketCount: number }) {
  return (
    <article
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-e1 transition-all hover:border-primary/30 hover:shadow-e2 motion-safe:hover:-translate-y-0.5"
      aria-label={`Chuyến từ ${trip.routeOrigin} đến ${trip.routeDestination}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-lg font-semibold">
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
          <span className="text-sm text-muted-foreground">
            {trip.operatorLegalName}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4" aria-hidden="true" />
          Khởi hành <strong className="font-mono text-foreground">{formatDepartureAt(trip.departureAt)}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Armchair className="size-4" aria-hidden="true" />
          Chỗ trống <strong className="text-foreground">{trip.availableSeats}</strong>
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Giá vé</span>
          <span className="font-mono text-xl font-bold text-primary">{formatPrice(trip.price)}</span>
        </div>
        <BookButton tripId={trip.tripId} ticketCount={ticketCount} />
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
        {showPrev && (
          <Link
            href={buildUrl(prevDate)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
            aria-label={`Tìm ngày trước: ${formatVnDate(prevDate)}`}
          >
            ← {formatVnDate(prevDate)}
          </Link>
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
  origin,
  destination,
  date,
  ticketCount,
  showPrev,
}: {
  trips: TripResult[];
  origin: string;
  destination: string;
  date: string;
  ticketCount: number;
  showPrev: boolean;
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

  return (
    <div className="flex flex-col gap-4">
      {/* Result count */}
      <p className="text-sm text-muted-foreground">
        Tìm thấy <strong className="text-foreground">{trips.length}</strong> chuyến xe
      </p>

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
          <span className="min-h-11" />
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

      {/* Trip cards */}
      <ul className="flex flex-col gap-3" aria-label={`${trips.length} chuyến xe`}>
        {trips.map((trip) => (
          <li key={trip.tripId}>
            <TripCard trip={trip} ticketCount={ticketCount} />
          </li>
        ))}
      </ul>
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
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-8">
        <h1 className="text-2xl font-bold">Tìm chuyến xe</h1>
        <SearchFormWrapper initialValues={raw} />
      </main>
    );
  }

  const { origin, destination, date, ticketCount } = parsed.data;

  const trips = await searchTrips({ origin, destination, date, ticketCount });

  // AC-4: suppress prev-day chip when searched date == today (Asia/Ho_Chi_Minh).
  // en-CA locale emits YYYY-MM-DD; pin timeZone to VN so DST/UTC drift cannot mis-render.
  const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const showPrev = date !== todayVN;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
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

      {trips.length === 0 ? (
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
          origin={origin}
          destination={destination}
          date={date}
          ticketCount={ticketCount}
          showPrev={showPrev}
        />
      )}
    </main>
  );
}
