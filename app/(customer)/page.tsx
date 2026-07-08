import type { Metadata } from 'next';
import { preload } from 'react-dom';
import { Banknote, ShieldCheck, Bus } from 'lucide-react';
import { SearchFormWrapper } from '@/components/search/SearchFormWrapper';
import { FeatureHighlights } from '@/components/home/FeatureHighlights';
import { PopularTrips } from '@/components/home/PopularTrips';
import { ContractCarRental } from '@/components/home/ContractCarRental';
import { IntroBanner } from '@/components/home/IntroBanner';
import { RouteDirectory } from '@/components/home/RouteDirectory';
import { TrustStrip } from '@/components/home/TrustStrip';
import { POPULAR_ROUTES, routeKey } from '@/components/home/popularRoutes';
import { Card, CardContent } from '@/components/ui/card';
import { getSearchablePlaces } from '@/lib/places';
import { getActiveRoutes } from '@/lib/core/db/getActiveRoutes';
import { getHomeMetrics } from '@/lib/home';
import { organizationLd } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Đặt vé xe khách | BBVN',
  description: 'Tìm và đặt vé xe khách liên tỉnh trên toàn quốc, đặt trong 30 giây.',
};

const TRUST = [
  { icon: Banknote, title: 'Chuyển khoản · Tiền mặt' },
  { icon: ShieldCheck, title: 'Xác nhận qua email' },
  { icon: Bus, title: 'Nhiều nhà xe' },
];

export default async function HomePage() {
  // Preload the hero cover (LCP image) so it starts fetching before hydration —
  // media-gated so each device only fetches its own size.
  preload('/hero/landing-1280.jpg', { as: 'image', media: '(max-width: 767px)' });
  preload('/hero/landing-2560.jpg', { as: 'image', media: '(min-width: 768px)' });
  const [places, activeRoutes, metrics] = await Promise.all([
    getSearchablePlaces(),
    getActiveRoutes(),
    getHomeMetrics(),
  ]);

  // Indicative "Từ" starting price per popular route, keyed by routeKey. Reuses the
  // /routes browse aggregate (getActiveRoutes → minPrice per origin/dest). Only the
  // pairs shown on the home carousel are mapped; routes with no upcoming trip are absent.
  const popularKeys = new Set(POPULAR_ROUTES.map((r) => routeKey(r.origin, r.destination)));
  const prices: Record<string, number | null> = {};
  for (const r of activeRoutes) {
    const key = routeKey(r.origin, r.destination);
    if (popularKeys.has(key)) prices[key] = r.minPrice;
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* SEO: Organization structured data for rich results. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd()) }}
      />
      {/* Hero band — full-bleed cover image behind a floating search card (Vexere pattern). */}
      <section id="search" className="relative w-full scroll-mt-16 overflow-hidden">
        {/* Cover image. Swap in a real photo: change the url to '/hero/landing.jpg'.
            Production LCP upgrade: replace this div with <Image fill priority src=… />. */}
        {/* Responsive source via two breakpoint-toggled layers (inline style — Turbopack
            drops url() referencing /public from bundled CSS, so inline is the reliable path).
            ≤767px → 1280 (light); ≥768px → 2560 (sharp on big/retina). bg-cover fits any viewport. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center brightness-95 will-change-transform motion-safe:animate-[kenburns_28s_ease-in-out_infinite_alternate] md:hidden"
          style={{ backgroundImage: "url('/hero/landing-1280.jpg')" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-cover bg-center brightness-95 will-change-transform motion-safe:animate-[kenburns_28s_ease-in-out_infinite_alternate] md:block"
          style={{ backgroundImage: "url('/hero/landing-2560.jpg')" }}
        />
        {/* Warm-orange brand wash — injects brand presence + warms/deepens the bright cover
            (multiply), diagonal so the band reads with depth, not a flat single gradient
            (mood-board: full-bleed warm-orange brand surface behind the search). */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-primary/10 to-transparent mix-blend-multiply"
        />
        {/* Scrim: darken under the white headline, then blend into the warm page bg at the
            bottom so the trust row flows (no hard dark slab — design-language §5). The
            via-transparent middle lets the warm wash above show through. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/25"
        />
        {/* Grain — breaks digital flatness over the photo (taste-skill). */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 pt-16 pb-12 text-center sm:pt-24 sm:pb-14">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-3xl font-bold tracking-tight text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.5)] sm:text-4xl">
              Đặt <span className="text-primary">vé xe khách</span> trong 30 giây
            </h1>
            <p className="text-base text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.45)]">
              Tìm chuyến, đặt vé, nhà xe gọi xác nhận. Không cần chọn ghế trên màn hình.
            </p>
          </div>

          <Card className="w-full text-left shadow-e4">
            <CardContent className="py-3">
              <SearchFormWrapper places={places} />
            </CardContent>
          </Card>
        </div>

        {/* Trust strip — forms the banner's bottom border (Vexere pattern). Glass over
            the photo, compact vertical icon-above-label badges. */}
        <div className="relative z-10 border-t border-white/15 bg-black/30 backdrop-blur-sm">
          <ul className="flex w-full list-none items-stretch justify-around divide-x divide-white/10 px-2 py-0 sm:px-6">
            {TRUST.map(({ icon: Icon, title }) => (
              <li key={title} className="flex flex-1 flex-col items-center gap-2 px-2 py-4 text-center">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/90 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-xs font-medium text-white sm:text-sm">{title}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Early trust/scale strip — real counts, threshold-gated (OTA pattern) */}
      <TrustStrip metrics={metrics} />

      {/* Why-choose-us feature highlights */}
      <FeatureHighlights />

      {/* Popular routes carousel (with indicative "Từ" starting price) */}
      <PopularTrips prices={prices} />

      {/* Contract car-rental — Thanh Hóa tourism showcase */}
      <ContractCarRental />

      {/* Popular routes directory (text links, SEO) */}
      <RouteDirectory />

      {/* Big animated intro / closing CTA banner — final beat before footer */}
      <IntroBanner />
    </main>
  );
}
