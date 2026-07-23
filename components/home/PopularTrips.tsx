'use client';

/**
 * PopularTrips — horizontal scroll-snap carousel of popular intercity routes on the
 * landing page. Rebuilt 2026-07-21 to the mockup's data card (docs/design/mockup-home.png
 * S4): destination photo on top, then route pair → duration + from-price → rating +
 * "Tìm vé". Clicking anywhere on the card pre-fills the search form via
 * /?origin=…&destination=…. Images live in public/destinations/<slug>.jpg and use a
 * plain <img> (native lazy-load; avoids the Turbopack `/public` url() drop seen with
 * CSS backgrounds).
 */

import { useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Clock, Star } from 'lucide-react';

import { searchHref } from '@/lib/search';
import { formatVnd } from '@/lib/format';
import { POPULAR_ROUTES, routeKey } from './popularRoutes';
import { CardImage } from './CardImage';
import { placeholderRating, placeholderReviewCount } from './homePlaceholders';

/** "450" → "7h 30m", "120" → "2h 00m". Mirrors the mockup's duration format. */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * `prices` / `durations` — starting ("Từ") price and shortest duration per route, keyed
 * by routeKey(origin, destination), computed server-side in app/(customer)/page.tsx from
 * getActiveRoutes(). A null/absent price entry means no upcoming bookable trip → the card
 * is dropped entirely. Indicative teaser (cheapest scheduled future trip) — may be sold
 * out, standard OTA "from" semantic.
 */
export function PopularTrips({
  prices,
  durations,
}: {
  prices: Record<string, number | null>;
  durations: Record<string, number | null>;
}) {
  const scrollerRef = useRef<HTMLUListElement>(null);

  const liveRoutes = POPULAR_ROUTES.filter(
    (r) => prices[routeKey(r.origin, r.destination)] != null,
  );

  if (liveRoutes.length === 0) return null;

  const useCarousel = liveRoutes.length >= 4;

  function nudge(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 lg:py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Tuyến đường phổ biến</h2>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm font-medium text-primary-strong outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Xem tất cả
          </Link>
          {useCarousel && (
            <div className="hidden gap-2 md:flex">
              <button
                type="button"
                onClick={() => nudge(-1)}
                aria-label="Cuộn sang trái"
                className="inline-flex size-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-e2 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => nudge(1)}
                aria-label="Cuộn sang phải"
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
        aria-label="Tuyến đường phổ biến"
        className={
          useCarousel
            ? 'flex snap-x snap-mandatory list-none gap-4 overflow-x-auto p-0 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2'
        }
      >
        {liveRoutes.map((r) => {
          const key = routeKey(r.origin, r.destination);
          const price = prices[key] ?? null;
          const duration = durations[key] ?? null;
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
                    ? `Tìm chuyến ${r.origin} đến ${r.destination}, từ ${formatVnd(price)}`
                    : `Tìm chuyến ${r.origin} đến ${r.destination}`
                }
                className="group flex h-full flex-col overflow-hidden rounded-xl bg-card shadow-e1 transition-all hover:shadow-e2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-safe:hover:-translate-y-0.5"
              >
                <div className="relative aspect-video w-full overflow-hidden">
                  <CardImage src={`/destinations/${r.slug}.jpg`} alt={r.destination} />
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
                      <span className="text-sm font-semibold">Từ {formatVnd(price)}</span>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2">
                    {/* PLACEHOLDER rating — no Review model exists. See homePlaceholders.ts. */}
                    <span className="flex items-center gap-1.5 text-sm">
                      <Star
                        className="size-4 shrink-0 fill-primary text-primary"
                        aria-hidden="true"
                      />
                      <span className="font-medium">{placeholderRating(r.slug)}</span>
                      <span className="text-muted-foreground">
                        ({placeholderReviewCount(r.slug)})
                      </span>
                    </span>
                    <span className="inline-flex h-9 items-center rounded-lg border border-primary/20 px-4 text-sm font-medium text-primary-strong transition-colors group-hover:bg-primary/5">
                      Tìm vé
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
