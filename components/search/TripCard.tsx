import { ArrowRight, BedDouble, Bus, GlassWater, MapPin, Plug, Wifi } from 'lucide-react';
import { BookButton } from '@/components/search/BookButton';
import { formatVnd } from '@/lib/format';
import { type TripResult, type BoardingStop } from '@/lib/trips';
import { BUS_TYPE_LABEL, formatTime, arrivalIso } from './search-utils';

export type TripCardSize = 'default' | 'expanded';

// Tiện ích cố định toàn đội xe (nhà xe xác nhận mọi xe đều có), CHƯA data-hoá theo
// từng chuyến — giống "Hỗ trợ 24/7". TODO: thêm cột amenities vào schema để hiển thị
// đúng theo từng xe. Vehicle type + số chỗ ("Limousine 32 chỗ") lấy data thật bên dưới.
const TRIP_AMENITIES = [
  { icon: Wifi, label: 'Wi-Fi' },
  { icon: GlassWater, label: 'Nước uống' },
  { icon: Plug, label: 'Ổ cắm' },
  { icon: BedDouble, label: 'Chân đắp' },
];

function formatVnDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

export function TripCard({
  trip,
  ticketCount,
  boardingStop,
}: {
  trip: TripResult;
  ticketCount: number;
  size?: TripCardSize;
  /** When set, this card represents ONE chosen boarding point of the trip. */
  boardingStop?: BoardingStop;
}) {
  const lowSeats = trip.availableSeats <= 5;
  const origin = boardingStop ? boardingStop.point : trip.routeOrigin;
  return (
    <article
      className="group flex flex-col gap-4 rounded-xl border border-border bg-white p-6 shadow-e1 transition-all hover:border-primary/30 hover:shadow-e2 motion-safe:hover:-translate-y-0.5"
      aria-label={`Chuyến từ ${origin} đến ${trip.routeDestination}`}
    >
      {/* Hàng chính: giờ đi | tuyến (connector co giãn) | giờ đến | giá + CTA */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
        {/* Giờ đi + ngày */}
        <div className="flex shrink-0 flex-col">
          <span className="font-mono text-2xl font-bold leading-none text-foreground">
            {formatTime(trip.departureAt)}
          </span>
          <span className="mt-1 text-sm text-muted-foreground">{formatVnDayMonth(trip.departureAt)}</span>
        </div>

        {/* Điểm đi ——→ điểm đến: connector trải hết width còn lại */}
        <div className="flex flex-1 items-center gap-4">
          <span className="flex shrink-0 items-center gap-2 text-lg font-semibold text-foreground">
            <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            {origin}
          </span>
          <span className="flex flex-1 items-center gap-2 text-muted-foreground">
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-lg font-semibold text-foreground">
            {trip.routeDestination}
            <MapPin className="size-5 shrink-0 text-primary" aria-hidden="true" />
          </span>
        </div>

        {/* Giờ đến */}
        <span className="shrink-0 font-mono text-2xl font-bold leading-none text-foreground">
          {formatTime(arrivalIso(trip.departureAt, trip.durationMinutes))}
        </span>

        {/* Giá + CTA + số chỗ */}
        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-2xl font-bold text-primary">{formatVnd(trip.price)}</span>
            <span className="text-sm text-muted-foreground">/ 1 vé</span>
          </div>
          <BookButton
            tripId={trip.tripId}
            ticketCount={ticketCount}
            boardingPoint={boardingStop?.point}
            boardingTime={boardingStop?.time}
            label="Chọn ghế"
          />
          <span className={`text-sm ${lowSeats ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
            Còn {trip.availableSeats} chỗ trống
          </span>
        </div>
      </div>

      {/* Hàng tiện ích: loại xe (thật) + tiện ích cố định */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Bus className="size-4 shrink-0 text-primary" aria-hidden="true" />
          {BUS_TYPE_LABEL[trip.busType]}
        </span>
        {TRIP_AMENITIES.map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </article>
  );
}
