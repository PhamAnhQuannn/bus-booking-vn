/**
 * Issue 072 — shared trip-detail presentation (AC5 de-duplication).
 *
 * Both the POST-PURCHASE confirmation page (app/booking/confirmation/[token],
 * keyed by the 192-bit confirmationToken) and the BOARDING verify page
 * (app/verify/[token], keyed by the Issue-071 signed JWT) render the same
 * "trip details" block: route, departure (Asia/Ho_Chi_Minh), bus plate, and
 * operator. Rather than maintain two near-duplicate `<dl>`s, both pages render
 * this one presentational component.
 *
 * SPLIT RATIONALE (why two routes, one presentation):
 *   - /booking/confirmation/[token]  — audience: the BUYER, immediately after
 *     purchase. Access key = the random confirmationToken in the URL. Also shows
 *     buyer-facing info (passenger name, total, add-to-calendar). PII OK — the
 *     buyer is viewing their own booking.
 *   - /verify/[token]                — audience: a BOARDING checker (driver/
 *     operator staff) scanning the ticket QR. Access key = a signed, tamper-
 *     evident token. PUBLIC + PII-FREE. Shows only what a boarding check needs.
 * Same trip facts, different access model + audience → keep both routes, share
 * only the trip-fact presentation here.
 *
 * Pure presentational: no data fetching, no Date.now(). The caller passes an
 * already-resolved Date (departure) + plain strings; this component only formats.
 */

import { Clock, Bus, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatDeparture(d: Date): string {
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="inline-flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export interface TripDetailCardProps {
  origin: string;
  destination: string;
  departureAt: Date;
  busPlate: string;
  operatorName: string;
  /** Optional bus type line (shown on the boarding/verify page). */
  busType?: string;
  /** Optional extra rows (e.g. operator hotline on the confirmation page). */
  children?: React.ReactNode;
  /** Card heading (defaults to the trip-details label). */
  title?: string;
}

export function TripDetailCard({
  origin,
  destination,
  departureAt,
  busPlate,
  operatorName,
  busType,
  children,
  title = 'Chi tiết chuyến đi',
}: TripDetailCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-2.5">
          <Row icon={MapPin} label="Tuyến">
            {origin} → {destination}
          </Row>
          <Row icon={Clock} label="Khởi hành">
            {formatDeparture(departureAt)}
          </Row>
          <Row icon={Bus} label="Xe">
            <span className="font-mono">{busPlate}</span>
          </Row>
          {busType ? (
            <Row icon={Bus} label="Loại xe">
              {busType}
            </Row>
          ) : null}
          <Row icon={Bus} label="Nhà xe">
            {operatorName}
          </Row>
          {children}
        </dl>
      </CardContent>
    </Card>
  );
}
