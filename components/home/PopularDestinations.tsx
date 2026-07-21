'use client';

/**
 * PopularDestinations — "Điểm đến được yêu thích" photo row (docs/design/mockup-home.png
 * S8). Five destination cards: photo on top, name and a daily-departure count in a plain
 * white strip below it (not overlaid on the photo — that is what separates this card from
 * the old PopularTrips tile).
 *
 * The per-day counts are PLACEHOLDER values (see homePlaceholders.ts). The real figure is
 * derivable from upcoming trips but lands at ~1-5/day at launch scale, well below a
 * credible display floor.
 *
 * The mockup's fifth card is Phú Quốc; there is no public/destinations/phu-quoc.jpg, so
 * Vũng Tàu takes that slot.
 */

import { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { searchHref } from '@/lib/search';
import { CardImage } from './CardImage';
import { placeholderTripsPerDay } from './homePlaceholders';

interface Destination {
  name: string;
  /** public/destinations/<slug>.jpg */
  slug: string;
  /** Origin used to seed the search form when the card is clicked. */
  from: string;
}

const DESTINATIONS: Destination[] = [
  { name: 'Đà Lạt', slug: 'da-lat', from: 'Sài Gòn' },
  { name: 'Nha Trang', slug: 'nha-trang', from: 'Sài Gòn' },
  { name: 'Sa Pa', slug: 'sa-pa', from: 'Hà Nội' },
  { name: 'Vũng Tàu', slug: 'vung-tau', from: 'Sài Gòn' },
  { name: 'Đà Nẵng', slug: 'da-nang', from: 'Hà Nội' },
];

export function PopularDestinations() {
  const scrollerRef = useRef<HTMLUListElement>(null);

  function nudge(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 lg:py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Điểm đến được yêu thích</h2>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm font-medium text-primary-strong outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Xem tất cả
          </Link>
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
        </div>
      </div>

      <ul
        ref={scrollerRef}
        role="region"
        aria-label="Điểm đến được yêu thích"
        className="flex snap-x snap-mandatory list-none gap-4 overflow-x-auto p-0 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {DESTINATIONS.map((d) => (
          <li
            key={d.slug}
            className="shrink-0 snap-start basis-[70%] sm:basis-[calc(50%-0.5rem)] md:basis-[calc(33.333%-0.667rem)] lg:basis-[calc(20%-0.8rem)]"
          >
            <Link
              href={searchHref(d.from, d.name)}
              aria-label={`Tìm chuyến đi ${d.name}`}
              className="group flex flex-col gap-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <div className="relative aspect-video w-full overflow-hidden rounded-xl shadow-e1 transition-all group-hover:shadow-e2">
                <CardImage src={`/destinations/${d.slug}.jpg`} alt={d.name} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-semibold leading-tight">{d.name}</span>
                {/* PLACEHOLDER daily departures — see homePlaceholders.ts. */}
                <span className="text-xs text-muted-foreground">
                  {placeholderTripsPerDay(d.slug)}+ chuyến/ngày
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
