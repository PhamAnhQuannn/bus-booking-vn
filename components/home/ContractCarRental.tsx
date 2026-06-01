'use client';

/**
 * ContractCarRental — "Dịch vụ thuê xe hợp đồng" showcase carousel. Display-only tiles
 * of famous Thanh Hóa tourism spots (no booking flow yet — non-interactive figures), with
 * a "Liên hệ thuê xe" CTA in the header. Mirrors the PopularTrips carousel mechanics
 * (scroll-snap, fraction-fit, page-wise arrows). Images: public/tourism/<slug>.jpg.
 */

import { useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Phone } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

interface Place {
  name: string;
  /** public/tourism/<slug>.jpg */
  slug: string;
}

const PLACES: Place[] = [
  { name: 'Biển Sầm Sơn', slug: 'sam-son' },
  { name: 'Thành Nhà Hồ', slug: 'thanh-nha-ho' },
  { name: 'Pù Luông', slug: 'pu-luong' },
  { name: 'Suối cá Cẩm Lương', slug: 'suoi-ca-cam-luong' },
  { name: 'Khu di tích Lam Kinh', slug: 'lam-kinh' },
  { name: 'Vườn quốc gia Bến En', slug: 'ben-en' },
  { name: 'Biển Hải Tiến', slug: 'hai-tien' },
  { name: 'Thác Mây', slug: 'thac-may' },
];

export function ContractCarRental() {
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
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Dịch vụ thuê xe hợp đồng</h2>
          <p className="text-base text-muted-foreground">
            Thuê xe hợp đồng đời mới, tài xế kinh nghiệm — tham quan các điểm du lịch nổi tiếng trên toàn quốc.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a href="/lien-he-dat-xe" className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}>
            <Phone className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Liên hệ thuê xe</span>
            <span className="sm:hidden">Liên hệ</span>
          </a>
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
      </div>

      <ul
        ref={scrollerRef}
        role="region"
        aria-label="Điểm du lịch Thanh Hóa"
        className="flex snap-x snap-mandatory list-none gap-4 overflow-x-auto p-0 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {PLACES.map((p) => (
          <li
            key={p.slug}
            className="shrink-0 snap-start basis-[88%] sm:basis-[calc(50%-0.5rem)] lg:basis-[calc(33.333%-0.667rem)] xl:basis-[calc(25%-0.75rem)]"
          >
            <figure className="group relative m-0 block aspect-[4/3] w-full overflow-hidden rounded-xl shadow-e1 transition-all hover:shadow-e2">
              {/* eslint-disable-next-line @next/next/no-img-element -- local /public thumbnail; next/image+sharp not used in this app */}
              <img
                src={`/tourism/${p.slug}.jpg`}
                alt={p.name}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent"
              />
              <figcaption className="absolute inset-x-0 bottom-0 p-4">
                <span className="flex items-center gap-1.5 text-lg font-semibold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]">
                  <MapPin className="size-5 shrink-0" aria-hidden="true" />
                  {p.name}
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
