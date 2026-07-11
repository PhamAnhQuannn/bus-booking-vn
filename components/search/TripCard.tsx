import Link from 'next/link';
import { ArrowRight, Armchair } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BookButton } from '@/components/search/BookButton';
import { formatVnd } from '@/lib/format';
import { type TripResult } from '@/lib/trips';
import { BUS_TYPE_LABEL, formatTime, arrivalIso, durationLabel } from './search-utils';

export function TripCard({ trip, ticketCount }: { trip: TripResult; ticketCount: number }) {
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
          <span className="font-mono text-xl font-bold text-primary">{formatVnd(trip.price)}</span>
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
