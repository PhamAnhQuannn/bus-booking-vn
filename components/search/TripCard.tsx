import Link from 'next/link';
import { ArrowRight, Armchair, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BookButton } from '@/components/search/BookButton';
import { formatVnd } from '@/lib/format';
import { type TripResult } from '@/lib/trips';
import { BUS_TYPE_LABEL, formatTime, arrivalIso, durationLabel } from './search-utils';

export type TripCardSize = 'default' | 'expanded';

// Plain-language gloss shown only in the expanded card, where one result carries
// the page — a first-time booker may not know what "Giường nằm" means.
const BUS_TYPE_DESC: Record<TripResult['busType'], string> = {
  coach: 'Ghế ngồi',
  sleeper: 'Giường nằm · xe khách nằm',
  limousine: 'Limousine · ghế cao cấp',
};

export function TripCard({
  trip,
  ticketCount,
  size = 'default',
}: {
  trip: TripResult;
  ticketCount: number;
  size?: TripCardSize;
}) {
  const lowSeats = trip.availableSeats <= 5;
  const expanded = size === 'expanded';
  return (
    <article
      className={`group flex flex-col rounded-xl border border-border bg-card shadow-e1 transition-all hover:border-primary/30 hover:shadow-e2 motion-safe:hover:-translate-y-0.5 ${expanded ? 'gap-4 p-6' : 'gap-3 p-5'}`}
      aria-label={`Chuyến từ ${trip.routeOrigin} đến ${trip.routeDestination}`}
    >
      {/* Operator + route */}
      <div className="flex items-start justify-between gap-3">
        <div className={`flex items-center gap-2 font-semibold ${expanded ? 'text-lg' : ''}`}>
          <span>{trip.routeOrigin}</span>
          <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{trip.routeDestination}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center justify-center rounded-full bg-primary/10 font-bold text-primary ${expanded ? 'size-9 text-sm' : 'size-7 text-xs'}`}
            aria-hidden="true"
          >
            {trip.operatorLegalName.replace(/^(Công ty|CÔNG TY)\s*/i, '').trim().charAt(0)}
          </span>
          <span className={expanded ? 'font-medium' : 'text-sm text-muted-foreground'}>{trip.operatorLegalName}</span>
        </div>
      </div>

      {/* Depart → arrive + duration */}
      <div className={`flex items-center gap-2 font-mono font-semibold ${expanded ? 'text-xl' : 'text-lg'}`}>
        <span>{formatTime(trip.departureAt)}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {durationLabel(trip.durationMinutes)}
        </span>
        <span className="text-muted-foreground">→</span>
        <span>{formatTime(arrivalIso(trip.departureAt, trip.durationMinutes))}</span>
      </div>

      {/* Badges: bus type + seats-left urgency */}
      <div className="flex flex-wrap items-center gap-2">
        {expanded ? (
          <span className="text-sm text-muted-foreground">{BUS_TYPE_DESC[trip.busType]}</span>
        ) : (
          <Badge variant="neutral">{BUS_TYPE_LABEL[trip.busType]}</Badge>
        )}
        <Badge variant={lowSeats ? 'pending' : 'neutral'}>
          <Armchair className="size-3.5" aria-hidden="true" />
          {lowSeats
            ? `Chỉ còn ${trip.availableSeats} chỗ`
            : expanded
              ? `${trip.availableSeats}/${trip.capacity} chỗ trống`
              : `Còn ${trip.availableSeats} chỗ`}
        </Badge>
      </div>

      {/* Boarding points (expanded only) — one bus, staggered pickups. */}
      {expanded && trip.boardingSchedule.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Đón:{' '}
            {trip.boardingSchedule
              .slice(0, 3)
              .map((s) => `${s.point} ${s.time}`)
              .join(' · ')}
            {trip.boardingSchedule.length > 3
              ? ` · +${trip.boardingSchedule.length - 3} điểm`
              : ''}
          </span>
        </p>
      )}

      {/* Price + actions */}
      <div className={`flex items-center justify-between gap-3 border-t border-border/60 ${expanded ? 'mt-2 pt-4' : 'mt-1 pt-3'}`}>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Giá vé</span>
          <span className={`font-mono font-bold text-primary ${expanded ? 'text-2xl' : 'text-xl'}`}>{formatVnd(trip.price)}</span>
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
