/**
 * TripInfoCard — read-only "Thông tin chuyến đi" summary for the merged checkout.
 *
 * Presentational only. All values are server-resolved (getTripDetails + the
 * boarding point chosen on the results card) — no invented fields. Vehicle type
 * + seat count come from the trip's busType/capacity and the requested
 * ticketCount, so no booking/hold DTO change is needed.
 */

import { ArrowRight, Calendar, Clock, MapPin, Bus, Armchair, Ticket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

export interface TripInfoCardProps {
  routeOrigin: string;
  routeDestination: string;
  departureAt: string; // ISO
  operatorLegalName: string;
  vehicleLabel: string; // e.g. "Limousine 32 chỗ"
  ticketCount: number;
  boardingPoint: string | null;
  boardingTime: string | null;
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

export function TripInfoCard({
  routeOrigin,
  routeDestination,
  departureAt,
  operatorLegalName,
  vehicleLabel,
  ticketCount,
  boardingPoint,
  boardingTime,
}: TripInfoCardProps) {
  const pickup = boardingPoint
    ? `${boardingPoint}${boardingTime ? ` – ${boardingTime}` : ''}`
    : 'Tại bến xe';

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Thông tin chuyến đi</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2 text-base font-semibold">
          <span>{routeOrigin}</span>
          <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{routeDestination}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4 sm:grid-cols-3">
          <Fact icon={Calendar} label="Thời gian đi" value={formatDate(departureAt)} />
          <Fact icon={Clock} label="Giờ khởi hành" value={formatTime(departureAt)} />
          <Fact icon={MapPin} label="Điểm đón" value={pickup} />
          <Fact icon={Bus} label="Nhà xe" value={operatorLegalName} />
          <Fact icon={Armchair} label="Loại xe" value={vehicleLabel} />
          <Fact icon={Ticket} label="Số ghế" value={`${ticketCount} ghế`} />
        </div>
      </CardContent>
    </Card>
  );
}
