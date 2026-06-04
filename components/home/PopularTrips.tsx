'use client';

/**
 * PopularTrips — horizontal scroll-snap carousel of popular intercity routes on the
 * landing page. Each tile is a destination photo + route label; clicking pre-fills the
 * search form via /search?origin=…&destination=… (the parse-fail branch in
 * app/search/page.tsx seeds SearchFormWrapper with these values). Images live in
 * public/destinations/<slug>.jpg and use a plain <img> (native lazy-load; avoids the
 * Turbopack `/public` url() drop seen with CSS backgrounds).
 */

import { useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

import { searchHref } from '@/lib/search';

interface PopularRoute {
  origin: string;
  destination: string;
  /** public/destinations/<slug>.jpg — keyed to the destination city. */
  slug: string;
}

const ROUTES: PopularRoute[] = [
  { origin: 'Thanh Hóa', destination: 'Sài Gòn', slug: 'sai-gon' },
  { origin: 'Sài Gòn', destination: 'Bình Dương', slug: 'binh-duong' },
  { origin: 'Sài Gòn', destination: 'Đà Lạt', slug: 'da-lat' },
  { origin: 'Hà Nội', destination: 'Sa Pa', slug: 'sa-pa' },
  { origin: 'Đà Nẵng', destination: 'Huế', slug: 'hue' },
  { origin: 'Hà Nội', destination: 'Hải Phòng', slug: 'hai-phong' },
  { origin: 'Sài Gòn', destination: 'Vũng Tàu', slug: 'vung-tau' },
  { origin: 'Hà Nội', destination: 'Đà Nẵng', slug: 'da-nang' },
  { origin: 'Sài Gòn', destination: 'Nha Trang', slug: 'nha-trang' },
  { origin: 'Sài Gòn', destination: 'Hà Nội', slug: 'ha-noi' },
];

export function PopularTrips() {
  const scrollerRef = useRef<HTMLUListElement>(null);

  function nudge(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Tuyến phổ biến</h2>
          <p className="text-base text-muted-foreground">Các tuyến xe khách được đặt nhiều nhất.</p>
        </div>
        <div className="hidden gap-2 md:flex">
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label="Cuộn sang trái"
            className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-e1 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label="Cuộn sang phải"
            className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-e1 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>
        </div>
      </div>

      <ul
        ref={scrollerRef}
        role="region"
        aria-label="Tuyến phổ biến"
        className="flex snap-x snap-mandatory list-none gap-4 overflow-x-auto p-0 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {ROUTES.map((r) => (
          <li
            key={`${r.origin}-${r.destination}`}
            className="shrink-0 snap-start basis-[88%] sm:basis-[calc(50%-0.5rem)] lg:basis-[calc(33.333%-0.667rem)] xl:basis-[calc(25%-0.75rem)]"
          >
            <Link
              href={searchHref(r.origin, r.destination)}
              aria-label={`Tìm chuyến ${r.origin} đến ${r.destination}`}
              className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl shadow-e1 transition-all hover:shadow-e2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-safe:hover:-translate-y-0.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local /public thumbnail; next/image+sharp not used in this app */}
              <img
                src={`/destinations/${r.slug}.jpg`}
                alt={r.destination}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent"
              />
              <span className="absolute right-3 top-3 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                Tìm chuyến
              </span>
              <div className="absolute inset-x-0 bottom-0 p-4">
                <span className="flex items-center gap-1.5 text-lg font-semibold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]">
                  {r.origin}
                  <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
                  {r.destination}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
