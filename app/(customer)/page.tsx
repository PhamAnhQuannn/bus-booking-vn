import type { Metadata } from 'next';
import { Suspense } from 'react';
import { preload } from 'react-dom';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Bus, BusFront, CreditCard, MailCheck, MapPin } from 'lucide-react';
import { searchParamsSchema, searchFiltersSchema } from '@/lib/core/validation/search';
import { track } from '@/lib/analytics';
import { searchTrips, SEARCH_PAGE_LIMIT } from '@/lib/trips';
import { applyTripFilters, todayVN } from '@/lib/search';
import { SearchFormWrapper } from '@/components/search/SearchFormWrapper';
import { SearchForm } from '@/components/search/SearchForm';
import { SearchStoreHydrator } from '@/components/search/SearchStoreHydrator';
import { EmptyState } from '@/components/search/EmptyState';
import { ResultsList } from '@/components/search/ResultsList';
import { ResultsHeading } from '@/components/search/ResultsHeading';
import { ResultsSkeleton } from '@/components/search/ResultsSkeleton';
import { PopularTrips } from '@/components/home/PopularTrips';
import { FeatureHighlights } from '@/components/home/FeatureHighlights';
import { ContractCarRental } from '@/components/home/ContractCarRental';
import { PopularDestinations } from '@/components/home/PopularDestinations';
import { NewsletterBand } from '@/components/home/NewsletterBand';
import { OperatorShowcase } from '@/components/home/OperatorShowcase';
import { POPULAR_ROUTES, routeKey } from '@/components/home/popularRoutes';
import { Card, CardContent } from '@/components/ui/card';
import { getSearchablePlaces } from '@/lib/places';
import { getActiveRoutes } from '@/lib/core/db/getActiveRoutes';
import { getPublicOperators } from '@/lib/home';
import { organizationLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const raw = {
    origin: typeof params.origin === 'string' ? params.origin : '',
    destination: typeof params.destination === 'string' ? params.destination : '',
    date: typeof params.date === 'string' ? params.date : '',
    ticketCount: typeof params.ticketCount === 'string' ? params.ticketCount : '',
  };
  const parsed = searchParamsSchema.safeParse(raw);
  if (parsed.success) {
    return {
      title: `${parsed.data.origin} → ${parsed.data.destination} | BBVN`,
      description: `Tìm chuyến xe từ ${parsed.data.origin} đến ${parsed.data.destination}`,
    };
  }
  return {
    title: 'Đặt vé xe khách | BBVN',
    description: 'Tìm và đặt vé xe khách liên tỉnh trên toàn quốc, đặt trong 30 giây.',
  };
}

const FEATURES = [
  { icon: CreditCard, title: 'Thanh toán đơn giản', sub: 'Chuyển khoản VietQR hoặc tiền mặt khi lên xe' },
  { icon: MailCheck, title: 'Xác nhận qua email', sub: 'Thông tin chuyến đi được gửi đến email của bạn' },
  { icon: Bus, title: 'Nhiều nhà xe uy tín', sub: 'Hợp tác cùng nhiều nhà xe chất lượng trên toàn quốc' },
  { icon: MapPin, title: 'Đón trả tận nơi', sub: 'Đón tại nhà hoặc khách sạn, trả đúng điểm bạn cần' },
];

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = {
    origin: typeof params.origin === 'string' ? params.origin : '',
    destination: typeof params.destination === 'string' ? params.destination : '',
    date: typeof params.date === 'string' ? params.date : '',
    ticketCount: typeof params.ticketCount === 'string' ? params.ticketCount : '',
  };
  const parsed = searchParamsSchema.safeParse(raw);

  if (parsed.success) {
    return (
      <Suspense fallback={<ResultsSkeleton />}>
        <SearchResultsView params={params} parsed={parsed.data} />
      </Suspense>
    );
  }

  return <HeroMarketingView />;
}

async function SearchResultsView({
  params,
  parsed,
}: {
  params: Record<string, string | string[] | undefined>;
  parsed: { origin: string; destination: string; date: string; ticketCount: number };
}) {
  const { origin, destination, date, ticketCount } = parsed;

  const todayVNDate = todayVN();
  if (date < todayVNDate) {
    const p = new URLSearchParams({ origin, destination, date: todayVNDate, ticketCount: String(ticketCount) });
    redirect(`/?${p.toString()}`);
  }

  const cursor = typeof params.cursor === 'string' ? params.cursor : null;

  const [base, page, places] = await Promise.all([
    searchTrips({ origin, destination, date, ticketCount, limit: Number.MAX_SAFE_INTEGER }),
    searchTrips({ origin, destination, date, ticketCount, cursor, limit: SEARCH_PAGE_LIMIT }),
    getSearchablePlaces(),
  ]);
  const baseTrips = base.trips;
  const nextCursor = page.nextCursor;

  const sessionId = (await cookies()).get('bb_sid')?.value ?? null;
  void track('search_performed', { sessionId, context: { resultCount: baseTrips.length } });

  const filterParams = searchFiltersSchema.safeParse(params);
  const activeFilters = filterParams.success ? filterParams.data : searchFiltersSchema.parse({});
  const { facets, totalBeforeFilters } = applyTripFilters(baseTrips, activeFilters);
  const { trips } = applyTripFilters(page.trips, activeFilters);

  const showPrev = date > todayVNDate;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <SearchStoreHydrator
        query={{ origin, destination, date, ticketCount }}
      />

      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          aria-label="Tìm lại — quay về trang tìm kiếm"
        >
          ← Tìm lại
        </Link>
        <ResultsHeading origin={origin} destination={destination} />
      </div>

      <Card className="shadow-e1">
        <CardContent className="py-3">
          <SearchForm places={places} orientation="horizontal" />
        </CardContent>
      </Card>

      {totalBeforeFilters === 0 ? (
        <EmptyState
          origin={origin}
          destination={destination}
          date={date}
          ticketCount={String(ticketCount)}
          showPrev={showPrev}
        />
      ) : (
        <ResultsList
          trips={trips}
          facets={facets}
          totalBeforeFilters={totalBeforeFilters}
          origin={origin}
          destination={destination}
          date={date}
          ticketCount={ticketCount}
          showPrev={showPrev}
          nextCursor={nextCursor}
          allParams={params}
        />
      )}
    </main>
  );
}

async function HeroMarketingView() {
  preload('/hero/landing-golden-1280.jpg', { as: 'image', media: '(max-width: 767px)' });
  preload('/hero/landing-golden-md-1536.jpg', { as: 'image', media: '(min-width: 768px) and (max-width: 1023px)' });
  preload('/hero/landing-golden-1920.jpg', { as: 'image', media: '(min-width: 1024px) and (max-width: 1919px)' });
  preload('/hero/landing-golden-3840.jpg', { as: 'image', media: '(min-width: 1920px)' });
  const [places, activeRoutes, operators] = await Promise.all([
    getSearchablePlaces(),
    getActiveRoutes(),
    getPublicOperators(),
  ]);

  const popularKeys = new Set(POPULAR_ROUTES.map((r) => routeKey(r.origin, r.destination)));
  const prices: Record<string, number | null> = {};
  const durations: Record<string, number | null> = {};
  for (const r of activeRoutes) {
    const key = routeKey(r.origin, r.destination);
    if (popularKeys.has(key)) {
      prices[key] = r.minPrice;
      durations[key] = r.minDurationMinutes;
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd()) }}
      />
      {/* scroll-mt tracks the SiteHeader height (h-18 / lg:h-21) plus 8px of
          breathing room, so #search anchor jumps clear the sticky bar.
          No `overflow-hidden`: the decorative layers below deliberately extend
          upward past this section's top edge to sit behind the header, and
          clipping would defeat that. */}
      <section id="search" className="relative w-full scroll-mt-20 lg:scroll-mt-[92px]">
        {/* Every decorative layer uses `-top-18 lg:-top-21` rather than `inset-0`:
            the photo box extends upward by exactly the header's height so the
            image starts at viewport y=0 and the sky sits behind the navbar. The
            header is z-40 and this section sets no z-index, so the photo paints
            behind it without any explicit stacking work. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-18 bg-cover bg-[position:72%_center] md:hidden lg:-top-21"
          style={{ backgroundImage: "url('/hero/landing-golden-1280.jpg')" }}
        />
        {/* md-only crop. The 2:1 master puts the bus at x 0.63-0.90, so a portrait-ish
            md box (AR ~1.14-1.52) crops it off the right edge. This 4:3 recrop centres
            the bus at x 0.383-0.833 so cover keeps it whole across the whole md range. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-18 hidden bg-cover bg-[position:50%_30%] md:block lg:hidden"
          style={{ backgroundImage: "url('/hero/landing-golden-md-1536.jpg')" }}
        />
        {/* lg+ framing is solved, not eyeballed. The reference hero is the SAME
            photograph as this master; the crop was recovered by normalised
            cross-correlation and validated against the bus ROOFLINE — a straight
            high-contrast edge deliberately excluded from the fit — which projected
            to within ±3px on an 1828px canvas (<0.2%). The reference's photo box
            maps to a 1316 x 626 window at master (444, 268), with margins on all
            four sides of this 1920x960 asset.

            The photo box spans header + hero, so the sky the reference shows
            behind its navbar is preserved.

            138%, down from 146%. background-size resolves against the BOX width,
            not the viewport, so the cover floor is 200 * box_h / box_w. The
            binding case is lg=1024, where the box measures 1009 x 690 — note the
            HEIGHT there is set by content wrapping, not by lg:min-h, so it is
            690 rather than the 654 the min-height alone would predict. That puts
            the floor at 136.8%; 138% clears it with ~6px of margin, measured.

            146% was the only floor-safe value while the hero was 640px, and it
            was also the most aggressive crop — it showed just 47.7% of the master,
            discarding the sun and the richest cloud band, and left every margin
            around the bus thin at once, which read as the vehicle being crowded.

            Do not reduce this without re-measuring the box at 1024: 130% was
            tried here and left a 35px gap. A bottom-edge gap has now shipped from
            this arithmetic three times. Both layers share these values (1920/3840
            are the same 2:1 crop). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-18 hidden bg-[length:138%_auto] bg-[position:72%_82%] lg:-top-21 lg:block 3xl:hidden"
          style={{ backgroundImage: "url('/hero/landing-golden-1920.jpg')" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-21 hidden bg-[length:138%_auto] bg-[position:72%_82%] 3xl:block"
          style={{ backgroundImage: "url('/hero/landing-golden-3840.jpg')" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-18 bg-gradient-to-b from-white/85 via-white/40 to-white/70 md:hidden lg:-top-21"
        />
        {/* Legibility wash, sized to the contrast floor rather than by feel.
            It used to run alpha 0.82 -> 0.66 across x=0-30%, which erased the
            photograph: gutter luminance sigma measured 7 against the reference's
            68 — numerically a flat fill, and the "top left fell white" the user
            reported. Measured against the darkest tone actually under the text
            (129,94,74), the subcopy clears its 4.5:1 AA floor at alpha ~0.345 and
            the headline clears 3:1 well below that. These stops sit at ~0.50 with
            deliberate margin over that floor, i.e. roughly half the old values.
            Do not raise them back without re-measuring contrast on the render. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-18 hidden md:block md:bg-[linear-gradient(90deg,rgba(255,247,237,0.56)_0%,rgba(255,247,237,0.44)_38%,rgba(255,247,237,0.22)_62%,rgba(255,247,237,0.07)_82%,rgba(255,247,237,0)_100%)] lg:-top-21 xl:bg-[linear-gradient(90deg,rgba(255,247,237,0.50)_0%,rgba(255,247,237,0.40)_30%,rgba(255,247,237,0.18)_52%,rgba(255,247,237,0.05)_72%,rgba(255,247,237,0)_100%)]"
        />
        {/* Navbar scrim — the white wash the nav labels sit on. Measured off the
            reference: alpha ≈0.96 through the left half, ramping to ~0 by the
            right edge, over a band exactly the header's height. It lives here
            rather than on SiteHeader because that component also renders on 17
            routes that have no photograph behind it.
            This is what keeps the nav labels legible: at x<50% the surface is
            effectively near-white, so `--primary-strong`'s AA margin — which was
            calibrated against flat white — still holds. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-18 h-18 bg-[linear-gradient(90deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.96)_50%,rgba(255,255,255,0.65)_62%,rgba(255,255,255,0.34)_83%,rgba(255,255,255,0.05)_96%,rgba(255,255,255,0)_100%)] lg:-top-21 lg:h-21"
        />
        {/* The right-edge black scrim that used to sit here was removed: it dimmed
            exactly the bright sky and cloud the reference keeps luminous, and the
            reference has no counterpart to it. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-18 opacity-[0.04] mix-blend-overlay lg:-top-21"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* 570px at lg, down from 640. The height is not a free choice: it sets
            the photo box, and the cover floor is 200 * box_h / box_w, so every
            pixel of hero height forces more zoom at lg=1024. 640 forced 146% and
            a crop showing under half the master; 570 drops the floor to ~129.7%.
            Content measures 539px, so this leaves ~30px of padding budget — tight
            by design. Anything that grows the content (longer copy, a locale
            change) will overflow here before it overflows anywhere else. */}
        <div className="relative mx-auto flex w-full max-w-[1920px] flex-col gap-6 px-4 pt-12 pb-16 sm:px-8 sm:pt-16 sm:pb-20 lg:min-h-[570px] lg:pt-14 lg:pb-8 xl:px-[104px]">
          <div className="flex max-w-[680px] flex-col items-start gap-4 text-left 2xl:max-w-[760px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-3.5 py-1.5 text-sm font-medium text-primary-strong backdrop-blur">
              <BusFront className="size-4" aria-hidden="true" />
              Đặt vé dễ dàng – Đi xe an toàn
            </span>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-[64px] md:leading-[1.05] 2xl:text-7xl">
              <span className="block">Đặt vé xe khách</span>
              <span className="block text-primary-strong">chỉ trong 30 giây</span>
            </h1>
            <p className="max-w-[620px] text-base text-foreground/80 sm:text-lg xl:text-[22px] xl:leading-snug 2xl:max-w-[680px]">
              Tìm chuyến, đặt vé, nhà xe gọi xác nhận. Không cần chọn ghế trên màn hình.
            </p>
          </div>

          {/* md cap mirrors the lg one: a full-width card would sit over the bus in the
              md hero crop. Capping it opens a right-hand column the way lg already does. */}
          <div className="flex w-full flex-col gap-4 md:max-w-[560px] lg:max-w-[calc(63vw-60px)] xl:max-w-[min(63vw-132px,13.2vw+828px)]">
            <Card className="w-full rounded-2xl text-left shadow-e4">
              <CardContent className="py-3 xl:px-8 xl:py-5">
                <SearchFormWrapper places={places} />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* The tint lives on this full-bleed wrapper rather than on the section itself:
          the section carries max-w-[1920px], so tinting it would leave untinted
          gutters at 3xl. */}
      <div className="border-b border-border bg-muted">
        <section aria-label="Điểm nổi bật" className="relative z-10 mx-auto w-full max-w-[1920px] px-4 py-6 sm:px-8 sm:py-8 xl:px-[104px]">
          <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, sub }) => (
              <li
                key={title}
                className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-e1 xl:p-6"
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary xl:size-12">
                  <Icon className="size-5 xl:size-6" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground xl:text-base">{title}</span>
                  <span className="text-sm text-muted-foreground 2xl:text-base">{sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <PopularTrips prices={prices} durations={durations} />

      <OperatorShowcase operators={operators} />

      <FeatureHighlights />

      <ContractCarRental />

      <PopularDestinations />

      <NewsletterBand />
    </main>
  );
}
