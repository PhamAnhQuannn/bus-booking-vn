/**
 * ContractCarRental — "Dịch vụ thuê xe hợp đồng" showcase. Display-only bento mosaic of
 * famous Thanh Hóa tourism spots (no booking flow yet — non-interactive figures), with a
 * "Liên hệ thuê xe" CTA in the header. Distinct layout family from the PopularTrips
 * carousel (static mixed-size grid, no scroll-snap). Images: public/tourism/<slug>.jpg.
 */

import { MapPin, Phone } from 'lucide-react';

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

/**
 * Per-index cell spans over a 6-column × 4-row desktop bento. Fixed row tracks
 * (`lg:auto-rows-[10.5rem]`) + tiles filling their cell guarantee every row's bottom
 * edges align — no ragged heights. 8 items → 8 filled cells, zero gaps: one 4×2 anchor
 * (idx0), then rows 3+3 (right column) / 2+2+2 / 3+3. On mobile the lg: spans drop away
 * (2-col track) and each tile uses a uniform 4:3 ratio (`lg:aspect-auto` clears it at lg).
 */
const CELLS = [
  'lg:col-span-4 lg:row-span-2',
  'lg:col-span-2 lg:row-span-1',
  'lg:col-span-2 lg:row-span-1',
  'lg:col-span-2 lg:row-span-1',
  'lg:col-span-2 lg:row-span-1',
  'lg:col-span-2 lg:row-span-1',
  'lg:col-span-3 lg:row-span-1',
  'lg:col-span-3 lg:row-span-1',
];

export function ContractCarRental() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Dịch vụ thuê xe hợp đồng</h2>
          <p className="text-base text-muted-foreground">
            Thuê xe hợp đồng đời mới, tài xế kinh nghiệm. Tham quan các điểm du lịch nổi tiếng trên toàn quốc.
          </p>
        </div>
        <a
          href="/lien-he-dat-xe"
          className={cn(buttonVariants({ variant: 'outline' }), 'shrink-0 gap-1.5')}
        >
          <Phone className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Liên hệ thuê xe</span>
          <span className="sm:hidden">Liên hệ</span>
        </a>
      </div>

      <ul
        aria-label="Điểm du lịch Thanh Hóa"
        className="reveal grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-6 lg:auto-rows-[10.5rem] lg:gap-4"
      >
        {PLACES.map((p, i) => (
          <li key={p.slug} className={cn('aspect-[4/3] lg:aspect-auto', CELLS[i])}>
            <figure className="group relative m-0 block size-full overflow-hidden rounded-xl shadow-e1 transition-all hover:shadow-e2">
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
