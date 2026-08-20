/**
 * /trips/[id] — public trip detail page.
 *
 * Full trip info (route, operator, departure, duration, comfort tier, pickup
 * points, availability, price) with a ticket-count stepper + book CTA.
 * notFound() when the trip is missing or not bookable.
 */

import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Clock, Armchair, Phone, Timer, MapPin } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTripDetails } from '@/lib/trips';
import { formatVnd } from '@/lib/format';
import { busTripLd, breadcrumbLd, SITE_URL, jsonLdHtml, localeAlternates } from '@/lib/seo';
import { TripBooking } from './TripBooking';

export const dynamic = 'force-dynamic';

// Audit F5: generateMetadata + the page body both called getTripDetails(id)
// uncached — two DB round-trips per request and two chances to time out.
// React cache() dedupes them within one request.
const getTripDetailsCached = cache(getTripDetails);

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
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const alternates = localeAlternates(`/trips/${id}`);
  // Metadata must never take down the page — a DB timeout here falls back to a
  // static title instead of throwing (audit F5).
  try {
    const trip = await getTripDetailsCached(id);
    if (!trip) return { title: t('trip.fallbackTitle'), alternates };
    // Route origin/destination + operator name are DATA — passed as args, never translated.
    return {
      title: t('trip.title', { origin: trip.routeOrigin, destination: trip.routeDestination }),
      description: t('trip.description', {
        origin: trip.routeOrigin,
        destination: trip.routeDestination,
        operator: trip.operatorLegalName,
      }),
      alternates,
    };
  } catch {
    return { title: t('trip.fallbackTitle'), alternates };
  }
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTripDetailsCached(id);
  if (!trip) notFound();

  const [t, ts] = await Promise.all([getTranslations('trips'), getTranslations('search')]);

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
      { name: t('detail.breadcrumbHome'), url: `${SITE_URL}/` },
      { name: t('detail.breadcrumbSearch'), url: `${SITE_URL}/` },
      { name: `${trip.routeOrigin} → ${trip.routeDestination}`, url: tripUrl },
    ]),
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      {/* SEO: BusTrip/Offer + breadcrumb structured data for rich results. */}
      <script
        type="application/ld+json"
        // SEC-XSS-JSONLD (#557): jsonLdHtml escapes <>&/U+2028/9 so operator free-text
        // (route names, legalName) can't break out of the inline script. Never bare JSON.stringify.
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />
      <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">{t('detail.breadcrumbHome')}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">{t('detail.breadcrumbSearch')}</Link></li>
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
              <div className="text-muted-foreground">{t('detail.depart')}</div>
              <div className="font-medium">{formatDeparture(trip.departureAt)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Timer className="mt-0.5 size-4 text-primary" aria-hidden="true" />
            <div>
              <div className="text-muted-foreground">{t('detail.duration')}</div>
              <div className="font-medium">~{formatDuration(trip.durationMinutes)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Armchair className="mt-0.5 size-4 text-primary" aria-hidden="true" />
            <div>
              <div className="text-muted-foreground">{t('detail.vehicleType')}</div>
              <div className="font-medium">{ts(`busType.${trip.busType}`)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Armchair className="mt-0.5 size-4 text-primary" aria-hidden="true" />
            <div>
              <div className="text-muted-foreground">{t('detail.seatsAvailable')}</div>
              <div className="font-medium">{trip.availableSeats}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operator contact */}
      <Card>
        <CardContent className="flex items-center gap-2 py-4 text-sm">
          <Phone className="size-4 text-primary" aria-hidden="true" />
          <span className="text-muted-foreground">{t('detail.operatorLabel')}</span>
          <a href={`tel:${trip.operatorContactPhone}`} className="font-medium text-primary hover:underline">
            {trip.operatorContactPhone}
          </a>
        </CardContent>
      </Card>

      {/* Boarding schedule — this bus makes staggered pickups on one trip. Times are
          the operator's published pickup times per point (display-only, from the card). */}
      {trip.boardingSchedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4 text-primary" aria-hidden="true" /> {t('detail.boardingTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-5">
            <ul className="flex flex-col divide-y divide-border/60 text-sm">
              {trip.boardingSchedule.map((s, i) => (
                <li key={`${s.point}-${i}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-foreground">{s.point}</span>
                  <span className="font-mono font-medium text-muted-foreground">{s.time}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              {t('detail.boardingNote')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Price + book CTA */}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-e3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{t('detail.pricePerPerson')}</span>
          <span className="font-mono text-2xl font-bold text-primary">{formatVnd(trip.price)}</span>
        </div>
        <TripBooking tripId={trip.tripId} availableSeats={trip.availableSeats} />
      </div>
    </main>
  );
}
