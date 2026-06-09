/**
 * /trips/[id] — public trip detail page.
 *
 * Full trip info (route, operator, departure, duration, comfort tier, pickup
 * points, availability, price) with a ticket-count stepper + book CTA.
 * notFound() when the trip is missing or not bookable.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Clock, Armchair, MapPin, Phone, Timer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTripDetails } from '@/lib/trips';
import { formatVnd } from '@/lib/format';
import { busTripLd, breadcrumbLd, SITE_URL } from '@/lib/seo';
import { TripBooking } from './TripBooking';

export const dynamic = 'force-dynamic';

const BUS_TYPE_LABEL: Record<'coach' | 'sleeper' | 'limousine', string> = {
  coach: 'Ghế ngồi',
  sleeper: 'Giường nằm',
  limousine: 'Limousine',
};

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h${m}` : `${h}h`;
}

function formatDeparture(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const trip = await getTripDetails(id);
  if (!trip) return { title: 'Chuyến xe | BBVN' };
  return {
    title: `${trip.routeOrigin} → ${trip.routeDestination} | BBVN`,
    description: `Chuyến ${trip.routeOrigin} đi ${trip.routeDestination} — ${trip.operatorLegalName}.`,
  };
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTripDetails(id);
  if (!trip) notFound();

  const tripUrl = `${SITE_URL}/trips/${trip.tripId}`;
  const arrivalIso = new Date(
    new Date(trip.departureAt).getTime() + trip.durationMinutes * 60000,
  ).toISOString();
  const jsonLd = [
    busTripLd({
      origin: trip.routeOrigin,
      destination: trip.routeDestination,
      departureTime: trip.departureAt,
      arrivalTime: arrivalIso,
      price: trip.price,
      operatorName: trip.operatorLegalName,
      url: tripUrl,
    }),
    breadcrumbLd([
      { name: 'Trang chủ', url: `${SITE_URL}/` },
      { name: 'Tìm chuyến', url: `${SITE_URL}/search` },
      { name: `${trip.routeOrigin} → ${trip.routeDestination}`, url: tripUrl },
    ]),
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      {/* SEO: BusTrip/Offer + breadcrumb structured data for rich results. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">Trang chủ</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/search" className="underline-offset-4 hover:text-foreground hover:underline">Tìm chuyến</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-foreground">
            {trip.routeOrigin} → {trip.routeDestination}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold tracking-tight">
          <span>{trip.routeOrigin}</span>
          <ArrowRight className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <span>{trip.routeDestination}</span>
        </h1>
        <p className="text-sm text-muted-foreground">{trip.operatorLegalName}</p>
      </div>

      {/* Facts */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 py-5 text-sm">
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 text-primary" aria-hidden="true" />
            <div>
              <div className="text-muted-foreground">Khởi hành</div>
              <div className="font-medium">{formatDeparture(trip.departureAt)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Timer className="mt-0.5 size-4 text-primary" aria-hidden="true" />
            <div>
              <div className="text-muted-foreground">Thời gian đi</div>
              <div className="font-medium">~{formatDuration(trip.durationMinutes)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Armchair className="mt-0.5 size-4 text-primary" aria-hidden="true" />
            <div>
              <div className="text-muted-foreground">Loại xe</div>
              <div className="font-medium">{BUS_TYPE_LABEL[trip.busType]}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Armchair className="mt-0.5 size-4 text-primary" aria-hidden="true" />
            <div>
              <div className="text-muted-foreground">Chỗ trống</div>
              <div className="font-medium">{trip.availableSeats}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pickup areas (Issue 106): huyện/xã this trip serves for personal pickup */}
      {trip.pickupAreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-base">
              Khu vực đón
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {trip.pickupAreas.map((a) => (
                <li key={a.label} className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div className="font-medium">{a.label}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Operator contact */}
      <Card>
        <CardContent className="flex items-center gap-2 py-4 text-sm">
          <Phone className="size-4 text-primary" aria-hidden="true" />
          <span className="text-muted-foreground">Nhà xe:</span>
          <a href={`tel:${trip.operatorContactPhone}`} className="font-medium text-primary hover:underline">
            {trip.operatorContactPhone}
          </a>
        </CardContent>
      </Card>

      {/* Price + book CTA */}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-e3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Giá vé / người</span>
          <span className="font-mono text-2xl font-bold text-primary">{formatVnd(trip.price)}</span>
        </div>
        <TripBooking tripId={trip.tripId} availableSeats={trip.availableSeats} />
      </div>
    </main>
  );
}
