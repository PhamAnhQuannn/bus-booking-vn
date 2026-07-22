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
      {/* scroll-mt tracks the SiteHeader height (h-18 / lg:h-24) plus 8px of
          breathing room, so #search anchor jumps clear the sticky bar. */}
      <section id="search" className="relative w-full scroll-mt-20 overflow-hidden lg:scroll-mt-[104px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-cover bg-[position:72%_center] md:hidden"
          style={{ backgroundImage: "url('/hero/landing-golden-1280.jpg')" }}
        />
        {/* md-only crop. The 2:1 master puts the bus at x 0.63-0.90, so a portrait-ish
            md box (AR ~1.14-1.52) crops it off the right edge. This 4:3 recrop centres
            the bus at x 0.383-0.833 so cover keeps it whole across the whole md range. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden bg-cover bg-[position:50%_30%] md:block lg:hidden"
          style={{ backgroundImage: "url('/hero/landing-golden-md-1536.jpg')" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden bg-cover bg-[position:53%_30%] lg:block 3xl:hidden"
          style={{ backgroundImage: "url('/hero/landing-golden-1920.jpg')" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden bg-cover bg-[position:0%_30%] lg:bg-[position:53%_30%] 3xl:block"
          style={{ backgroundImage: "url('/hero/landing-golden-3840.jpg')" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/85 via-white/40 to-white/70 md:hidden"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden md:block md:bg-[linear-gradient(90deg,rgba(255,247,237,0.88)_0%,rgba(255,247,237,0.72)_38%,rgba(255,247,237,0.38)_62%,rgba(255,247,237,0.12)_82%,rgba(255,247,237,0)_100%)] xl:bg-[linear-gradient(90deg,rgba(255,247,237,0.82)_0%,rgba(255,247,237,0.66)_30%,rgba(255,247,237,0.30)_52%,rgba(255,247,237,0.08)_72%,rgba(255,247,237,0)_100%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden md:block md:bg-[linear-gradient(90deg,rgba(0,0,0,0)_62%,rgba(0,0,0,0.2)_100%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative mx-auto flex w-full max-w-[1920px] flex-col gap-6 px-4 pt-12 pb-16 sm:px-8 sm:pt-16 sm:pb-20 lg:min-h-[720px] lg:pt-[120px] xl:px-[104px]">
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
