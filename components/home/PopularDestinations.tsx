'use client';

/**
 * PopularDestinations — "Điểm đến được yêu thích" photo row (docs/design/mockup-home.png
 * S8). Five destination cards: full-bleed photo with the name overlaid on a bottom gradient
 * scrim (white text). Plain carousel — no departure counts, no "Xem tất cả" (see below).
 *
 * 2026-07-30: each card also carried a "N+ chuyến/ngày" departure count. Those were
 * placeholders in the 80-110 band while the real figure is ~1-5/day at launch scale —
 * an order of magnitude out, on the customer-facing homepage. The count is derivable,
 * but showing a true "2 chuyến/ngày" was not the intent of the design either, so the
 * line is removed until the real number is worth showing.
 *
 * The mockup's fifth card is Phú Quốc; there is no public/destinations/phu-quoc.jpg, so
 * Vũng Tàu takes that slot.
 */

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { searchHref } from '@/lib/search';
import { CardImage } from './CardImage';

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
  const t = useTranslations('home');
  const scrollerRef = useRef<HTMLUListElement>(null);

  function nudge(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  }

  return (
    <section className="page-container py-3 lg:py-4">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('dest.title')}</h2>
        <div className="flex items-center gap-3">
          {/* 2026-07-30: a "Xem tất cả" link pointed at "/" — same page. Removed until
              a destination-index page exists. */}
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
        </div>
      </div>

      <ul
        ref={scrollerRef}
        role="region"
        aria-label={t('dest.title')}
        className="flex snap-x snap-mandatory list-none gap-4 overflow-x-auto p-0 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {DESTINATIONS.map((d) => (
          <li
            key={d.slug}
            className="shrink-0 snap-start basis-[70%] sm:basis-[calc(50%-0.5rem)] md:basis-[calc(33.333%-0.667rem)] lg:basis-[calc(20%-0.8rem)]"
          >
            <Link
              href={searchHref(d.from, d.name)}
              aria-label={t('dest.findTripTo', { name: d.name })}
              className="group relative block aspect-video overflow-hidden rounded-xl shadow-e1 ring-1 ring-black/5 outline-none transition-all hover:shadow-e2 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <CardImage src={`/destinations/${d.slug}.jpg`} alt={d.name} />
              {/* Name overlaid on the photo (gradient scrim for legibility), not a strip below. */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-3 pt-10">
                <span className="text-base font-semibold leading-tight text-white drop-shadow-sm">
                  {d.name}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
