'use client';

/**
 * PopularTrips — horizontal scroll-snap carousel of the routes we actually operate on
 * the landing page. Card (docs/design/mockup-home.png S4): destination photo on top, then
 * route pair → duration + from-price → "Tìm vé". Clicking anywhere pre-fills the search
 * form via /?origin=…&destination=…. Images live in public/destinations/<slug>.jpg and use
 * a plain <img> (native lazy-load; avoids the Turbopack `/public` url() drop seen with CSS
 * backgrounds); a missing photo degrades to CardImage's neutral fallback tile.
 *
 * 2026-08-09: source switched from the hardcoded POPULAR_ROUTES list to REAL open trips.
 * The RSC (app/(customer)/page.tsx) maps getActiveRoutes() → `trips` (only routes with an
 * upcoming bookable trip), so every card is a route a customer can actually book — no
 * dead-end links, and the section self-scales as operators/routes are added.
 */

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { searchHref } from '@/lib/search';
import { formatVnd } from '@/lib/format';
import { CardImage } from './CardImage';

export interface PopularTrip {
  origin: string;
  destination: string;
  /** public/destinations/<slug>.jpg — slug of the destination (slugify'd server-side). */
  slug: string;
  /** Cheapest upcoming fare (VND) — indicative "Từ" teaser. */
  price: number;
  /** Shortest route duration in minutes. */
  duration: number;
}

/** "450" → "7h 30m", "120" → "2h 00m". Mirrors the mockup's duration format. */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * `trips` — the routes we actually operate, already filtered to those with an upcoming
 * bookable trip (getActiveRoutes()), each carrying its cheapest fare + shortest duration.
 * Empty → the section self-hides. `price` is an indicative "Từ" teaser (cheapest scheduled
 * future trip) — may be sold out, standard OTA "from" semantic.
 */
export function PopularTrips({ trips }: { trips: PopularTrip[] }) {
  const t = useTranslations('home');
  const scrollerRef = useRef<HTMLUListElement>(null);

  if (trips.length === 0) return null;

  const useCarousel = trips.length >= 4;

  function nudge(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  }

  return (
    <section className="page-container pt-10 pb-3 lg:pt-14 lg:pb-4">
      <div className="mb-8 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('trips.title')}</h2>
        <div className="flex items-center gap-3">
          {/* 2026-07-30: a "Xem tất cả" link pointed at "/" — it reloaded this same
              page. No route-index page exists to point it at, so it is gone until
              one does. */}
          {useCarousel && (
            <div className="hidden gap-2 md:flex">
              <button
                type="button"
                onClick={() => nudge(-1)}
                aria-label={t('carousel.scrollLeft')}
                className="inline-flex size-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-e2 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => nudge(1)}
                aria-label={t('carousel.scrollRight')}
                className="inline-flex size-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-e2 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      <ul
        ref={useCarousel ? scrollerRef : undefined}
        role="region"
        aria-label={t('trips.title')}
        className={
          useCarousel
            ? 'flex snap-x snap-mandatory list-none gap-4 overflow-x-auto p-0 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2'
        }
      >
        {trips.map((r) => {
          const price = r.price;
          const duration = r.duration;
          return (
            <li
              key={`${r.origin}-${r.destination}`}
              className={
                useCarousel
                  ? 'shrink-0 snap-start basis-[88%] sm:basis-[calc(50%-0.5rem)] lg:basis-[calc(33.333%-0.667rem)] xl:basis-[calc(25%-0.75rem)]'
                  : undefined
              }
            >
              <Link
                href={searchHref(r.origin, r.destination)}
                aria-label={
                  price != null
                    ? t('trips.findTripWithPrice', { origin: r.origin, destination: r.destination, price: formatVnd(price) })
                    : t('trips.findTrip', { origin: r.origin, destination: r.destination })
                }
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-e1 transition-all hover:shadow-e2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-safe:hover:-translate-y-0.5"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <CardImage src={`/destinations/${r.slug}.jpg`} alt={r.origin} />
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <span className="flex items-center gap-1.5 text-base font-semibold leading-tight">
                    {r.origin}
                    <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    {r.destination}
                  </span>

                  <div className="flex items-center justify-between gap-2">
                    {duration != null ? (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="size-4 shrink-0" aria-hidden="true" />
                        {formatDuration(duration)}
                      </span>
                    ) : (
                      <span />
                    )}
                    {price != null && (
                      <span className="text-sm font-semibold">{t('trips.fromPrice', { price: formatVnd(price) })}</span>
                    )}
                  </div>

                  {/* 2026-07-30: a star rating and "(1.2k)" review count sat here. Both
                      were hashes of the route slug — there is no Review model. Removed
                      rather than emptied. */}
                  <div className="mt-auto flex items-center justify-end gap-2">
                    <span className="inline-flex h-9 items-center rounded-lg border border-primary/20 px-4 text-sm font-medium text-primary-strong transition-colors group-hover:bg-primary/5">
                      {t('trips.findTicket')}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
