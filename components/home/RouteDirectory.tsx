import Link from 'next/link';
import { ArrowRight, Bus } from 'lucide-react';

import { searchHref } from '@/lib/search/searchHref';

/**
 * RouteDirectory — a flat grid of popular intercity routes (text links). Each links to
 * a pre-filled search (/search?origin=&destination=). Discovery + SEO; static.
 */

interface Route {
  origin: string;
  destination: string;
}

const ROUTES: Route[] = [
  { origin: 'Hà Nội', destination: 'Sài Gòn' },
  { origin: 'Hà Nội', destination: 'Hải Phòng' },
  { origin: 'Hà Nội', destination: 'Sa Pa' },
  { origin: 'Hà Nội', destination: 'Đà Nẵng' },
  { origin: 'Hà Nội', destination: 'Thanh Hóa' },
  { origin: 'Hà Nội', destination: 'Vinh' },
  { origin: 'Sài Gòn', destination: 'Đà Lạt' },
  { origin: 'Sài Gòn', destination: 'Nha Trang' },
  { origin: 'Sài Gòn', destination: 'Vũng Tàu' },
  { origin: 'Sài Gòn', destination: 'Cần Thơ' },
  { origin: 'Sài Gòn', destination: 'Đà Nẵng' },
  { origin: 'Sài Gòn', destination: 'Bình Dương' },
  { origin: 'Đà Nẵng', destination: 'Huế' },
  { origin: 'Nha Trang', destination: 'Đà Lạt' },
  { origin: 'Thanh Hóa', destination: 'Sài Gòn' },
  { origin: 'Cần Thơ', destination: 'Đà Lạt' },
  { origin: 'Huế', destination: 'Đà Nẵng' },
  { origin: 'Đà Lạt', destination: 'Sài Gòn' },
];

export function RouteDirectory() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12">
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <Bus className="size-6 text-primary" aria-hidden="true" />
          Tuyến đường phổ biến
        </h2>
        <p className="text-base text-muted-foreground">
          Đặt vé xe khách cho các tuyến liên tỉnh được tìm nhiều nhất.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {ROUTES.map((r) => (
          <li key={`${r.origin}-${r.destination}`}>
            <Link
              href={searchHref(r.origin, r.destination)}
              className="group flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <span className="font-medium">{r.origin}</span>
              <ArrowRight className="size-4 shrink-0 text-primary/70 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              <span className="font-medium">{r.destination}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
