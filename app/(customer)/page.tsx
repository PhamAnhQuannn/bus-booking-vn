import type { Metadata } from 'next';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Bus, BusFront, CreditCard, MailCheck, MapPin, Sparkles } from 'lucide-react';
import { searchParamsSchema, searchFiltersSchema } from '@/lib/core/validation/search';
import { track } from '@/lib/analytics';
import { searchTrips, SEARCH_PAGE_LIMIT, parseBoardingSchedule, nearestUpcomingTripDate } from '@/lib/trips';
import { applyTripFilters, todayVN } from '@/lib/search';
import { SearchFormWrapper } from '@/components/search/SearchFormWrapper';
import { SearchForm } from '@/components/search/SearchForm';
import { SearchStoreHydrator } from '@/components/search/SearchStoreHydrator';
import { EmptyState } from '@/components/search/EmptyState';
import { ResultsList } from '@/components/search/ResultsList';
import { ResultsHeading } from '@/components/search/ResultsHeading';
import { ResultsSkeleton } from '@/components/search/ResultsSkeleton';
import { PopularTrips } from '@/components/home/PopularTrips';
import { TripPlannerPromo } from '@/components/home/TripPlannerPromo';
import { ContractCarRental } from '@/components/home/ContractCarRental';
import { PopularDestinations } from '@/components/home/PopularDestinations';
import { OperatorShowcase } from '@/components/home/OperatorShowcase';
import { Card, CardContent } from '@/components/ui/card';
import { getSearchablePlaces, slugify } from '@/lib/places';
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
  // 2026-07-30: was "Nhiều nhà xe uy tín" / "Hợp tác cùng nhiều nhà xe chất lượng trên
  // toàn quốc". That asserts a nationwide partner network; at launch there is one
  // operator, so it was simply untrue. Replaced with a claim the platform can actually
  // back: every operator is reviewed and approved (PENDING_REVIEW → APPROVED) before any
  // of its trips become bookable.
  { icon: Bus, title: 'Nhà xe được xác minh', sub: 'Mỗi nhà xe đều được duyệt trước khi mở bán vé' },
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

  // No blank page for a route that runs other days: if the requested day has no trips
  // (e.g. today's bus already departed), jump to the nearest upcoming date that does.
  // Forward-only + seat-agnostic → at most one hop (target with no seats stops at itself).
  if (baseTrips.length === 0) {
    const near = await nearestUpcomingTripDate(origin, destination, date);
    if (near && near !== date) {
      const p = new URLSearchParams({ origin, destination, date: near, ticketCount: String(ticketCount) });
      redirect(`/?${p.toString()}`);
    }
  }

  // Single-operator trust panel data — real fields off the first result.
  const operator = baseTrips[0]
    ? { legalName: baseTrips[0].operatorLegalName, contactPhone: baseTrips[0].operatorContactPhone }
    : undefined;

  const sessionId = (await cookies()).get('bb_sid')?.value ?? null;
  void track('search_performed', { sessionId, context: { resultCount: baseTrips.length } });

  const filterParams = searchFiltersSchema.safeParse(params);
  const activeFilters = filterParams.success ? filterParams.data : searchFiltersSchema.parse({});
  const { facets, totalBeforeFilters } = applyTripFilters(baseTrips, activeFilters);
  const { trips } = applyTripFilters(page.trips, activeFilters);

  const showPrev = date > todayVNDate;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">
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
        // Center the empty-state in the leftover height so a short "no trips" page
        // reads as intentional instead of clustering at the top over a big void.
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <EmptyState
            origin={origin}
            destination={destination}
            date={date}
            ticketCount={String(ticketCount)}
            showPrev={showPrev}
          />
        </div>
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
          operator={operator}
        />
      )}
    </main>
  );
}

async function HeroMarketingView() {
  const [places, activeRoutes, operators] = await Promise.all([
    getSearchablePlaces(),
    getActiveRoutes(),
    getPublicOperators(),
  ]);

  // Popular trips = routes we actually operate, EXPANDED by boarding point so a rider in
  // each pickup town sees their own "Nông Cống → Sài Gòn" card. Every card links via
  // searchHref → alias resolution finds the one real trip (no separate trips, no oversell).
  // Card image is keyed by ORIGIN (the pickup town) so cards don't all share one photo.
  // Towns without their own Wikimedia photo fall back to a province image.
  const IMAGE_FALLBACK: Record<string, string> = {
    'nong-cong': 'thanh-hoa',
    'cho-tan-khai': 'binh-phuoc',
    'song-than': 'binh-duong',
    'an-phu': 'binh-duong',
    'tan-dong-hiep': 'binh-duong',
    'nga-tu-mieu-ong-cu': 'binh-duong',
    'nga-tu-550': 'binh-duong',
  };
  const seen = new Set<string>();
  const popularTrips = activeRoutes
    .flatMap((r) => {
      const stops = parseBoardingSchedule(r.boardingSchedule);
      const origins = [r.origin, ...stops.map((s) => s.point)];
      return origins.map((origin) => {
        const s = slugify(origin);
        return {
          origin,
          destination: r.destination,
          slug: IMAGE_FALLBACK[s] ?? s,
          price: r.minPrice,
          duration: r.minDurationMinutes,
        };
      });
    })
    .filter((t) => {
      const k = `${t.origin}→${t.destination}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 12);

  return (
    <main className="flex flex-1 flex-col bg-[#FFFCFA]">
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
        {/* Single 16:9 hero image via next/image (fill + sizes=100vw): serves the
            exact resolution per device WIDTH × DPR (AVIF/WebP), so wide monitors no
            longer upscale a fixed asset. `-top-12 lg:-top-16` extends the box up behind
            the sticky header. object-position frames the bus (far-right) per breakpoint;
            mobile/md pan right to keep the bus, lg+ shows full width. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-12 lg:-top-16"
        >
          <Image
            src="/hero/landing-hero-v8.jpg"
            alt=""
            fill
            priority
            quality={90}
            sizes="100vw"
            className="object-cover object-[85%_58%] md:object-[80%_56%] lg:object-[50%_100%] 2xl:object-[50%_72%]"
          />
        </div>
        {/* Mobile wash. Was 85/40/70, which put ~40-55% white over the whole
            vehicle — the bus was hazed out by roughly half-opacity paint, and
            that was a bigger contributor to "the bus looks blurry" on a phone
            than resolution was.

            Text legibility no longer depends on this layer: the headline and
            subcopy carry their own measured scrim (see below), so this only has
            to keep the photograph from competing, not carry a contrast floor.
            Halving it takes the visible bus from ~53% white down to ~20%. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-12 bg-gradient-to-b from-white/45 via-white/10 to-white/15 md:hidden lg:-top-16"
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
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-12 hidden md:block md:bg-[linear-gradient(90deg,rgba(255,247,237,0.40)_0%,rgba(255,247,237,0.30)_38%,rgba(255,247,237,0.14)_62%,rgba(255,247,237,0.04)_82%,rgba(255,247,237,0)_100%)] lg:-top-16 xl:bg-[linear-gradient(90deg,rgba(255,247,237,0.36)_0%,rgba(255,247,237,0.26)_30%,rgba(255,247,237,0.12)_52%,rgba(255,247,237,0.03)_72%,rgba(255,247,237,0)_100%)]"
        />
        {/* The navbar scrim that used to sit here — a white wash ramping 0.97 to
            0 across the bar — has been REMOVED. It existed for one reason: the
            active nav label was orange (#CA3500, relative luminance 0.151),
            which needs its backdrop at ~RGB 243 to clear 4.5:1, and that forced
            a near-white strip across the top of the photograph.

            The active label is now dark text plus its orange underline, so the
            constraint is gone and SiteHeader's own `bg-background/45` glass
            carries legibility on its own (~8.9:1 for the labels). Deleting the
            scrim is what actually lets the bar read as glass rather than as a
            white bar with a blur behind it.

            If an orange label ever comes back to the navbar, this layer — or
            something like it — has to come back with it. */}
        {/* The right-edge black scrim that used to sit here was removed: it dimmed
            exactly the bright sky and cloud the reference keeps luminous, and the
            reference has no counterpart to it. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-12 opacity-[0.04] mix-blend-overlay lg:-top-16"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        {/* Bottom feather: short fade dissolving the hero photo into the cream trust
            strip (#FFF6EE) below, so the hero melts into the strip with no hard seam.
            Page field itself is near-white #FFFCFA (main bg). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-[#FFF6EE]"
        />

        {/* 570px at lg, down from 640. The height is not a free choice: it sets
            the photo box, and the cover floor is 200 * box_h / box_w, so every
            pixel of hero height forces more zoom at lg=1024. 640 forced 146% and
            a crop showing under half the master; 570 drops the floor to ~129.7%.
            Content measures 539px, so this leaves ~30px of padding budget — tight
            by design. Anything that grows the content (longer copy, a locale
            change) will overflow here before it overflows anywhere else.

            CẬP NHẬT: băng trust giờ nằm ĐÈ đáy hero, cao ~56px. lg:pb-8 (32px)
            nhỏ hơn nên thẻ tìm kiếm sẽ bị băng che 24px — phải nâng pb lên 72px
            (56 băng + 16 thở) và cộng đúng phần chênh đó vào min-h: 570 + 40 =
            610. Ngân sách 30px nói trên đã bị tiêu hết, không còn chỗ dư. */}
        <div className="page-container relative flex flex-col gap-6 pt-8 pb-12 sm:pt-12 sm:pb-14 lg:min-h-[610px] lg:pt-14 lg:pb-[72px]">
          <div className="relative isolate flex max-w-[680px] flex-col items-start gap-4 text-left 2xl:max-w-[760px]">
            {/* Mobile-only legibility scrim, sized to a MEASURED contrast floor
                (scripts/smoke/hero-wash-capture.mjs + the solve beside it).
                Measured on the 390px render against the darkest 2% of photo
                under each text box:

                  h1 line 1  rgba(28,22,18)   needs 3:1   -> 33.0% white
                  h1 line 2  rgba(202,53,0)   needs 3:1   -> 69.2% white  <- binding
                  subcopy    rgba(27,22,17,.8) needs 4.5:1 -> 55.6% white

                The old full-hero wash gave the middle of the hero only ~40%, so
                the orange headline line sat at 2.1:1 and the subcopy at 4.45:1 —
                both under their floors. Raising the whole wash to 69% would have
                fixed that by fogging the entire photograph, including the bus.
                A local scrim buys the same contrast over the text ONLY, which is
                what lets the wash below come down.

                70% here composites with the reduced wash to ~73-78% over the
                text band — clear of the 69.2% floor with margin.

                It is absolutely positioned rather than padding on the parent so
                that adding it shifts NOTHING; `isolate` on the parent keeps the
                negative z-index inside this stacking context instead of dropping
                the scrim behind the photo layers. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-4 -inset-y-3 -z-10 rounded-2xl bg-white/70 backdrop-blur-[2px] md:hidden"
            />
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
          <div className="flex w-full flex-col gap-4">
            <Card className="w-full rounded-2xl py-0 text-left shadow-e4">
              <CardContent className="py-4 xl:px-8 xl:py-6">
                <SearchFormWrapper places={places} />
                <Link
                  href="/tro-ly-du-lich"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary-strong hover:underline"
                >
                  <Sparkles className="size-4 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="font-normal text-muted-foreground">Chưa biết đi đâu? </span>
                    Lập kế hoạch chuyến đi với Trợ lý du lịch AI
                  </span>
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust panel: light card floating over the hero photo's bottom edge (mockup S1).
          Replaces the old dark bg-black/52 band-over-photo: on the light-orange page field a
          white card needs no photo-overlap contrast math. Renders both title + sub (2 lines). */}
      <section
        aria-label="Điểm nổi bật"
        className="relative z-raised -mt-8 mb-6 w-full border-b border-border bg-[#FFF6EE] shadow-e2 lg:-mt-12"
      >
        <ul className="grid w-full list-none grid-cols-1 gap-5 px-4 py-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:gap-0 lg:px-12 lg:py-0">
          {FEATURES.map(({ icon: Icon, title, sub }) => (
            <li
              key={title}
              className="flex items-center gap-4 lg:border-l lg:border-border lg:px-6 lg:py-6 lg:first:border-l-0"
            >
              <Icon className="size-7 shrink-0 text-primary-strong" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-semibold leading-tight text-foreground">{title}</span>
                <span className="text-sm leading-snug text-muted-foreground">{sub}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <PopularTrips trips={popularTrips} />

      <TripPlannerPromo />

      <PopularDestinations />

      <OperatorShowcase operators={operators} />

      <ContractCarRental />

      {/* 2026-07-30: <NewsletterBand /> was mounted here. It rendered an email field
          and a "Đăng ký" button with no action, no handler and no backend — it took a
          customer's address and silently discarded it. Collecting personal data you
          cannot act on is worse than not asking, and under PDPL it is collection
          without purpose. Re-mount it when a newsletter actually exists. */}
    </main>
  );
}
