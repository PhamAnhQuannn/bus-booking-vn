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
  // `imageSrcSet` mirrors each layer's `image-set()` exactly, so the preload
  // scanner fetches the same candidate the CSS will later pick. Density
  // descriptors need no `imageSizes`.
  //
  // Deliberately NO `type`: a link carries one MIME for the whole srcset, and
  // this srcset is mixed JPEG + WebP, so any value would be wrong for one of
  // them. Format is not negotiated here either -- `image-set()`'s `type()` has
  // an open WebKit bug and is unsupported in Safari, so the format is fixed per
  // candidate and only DENSITY is negotiated.
  preload('/hero/landing-golden-1280.jpg', {
    as: 'image',
    media: '(max-width: 767px)',
    imageSrcSet: '/hero/landing-golden-1280.jpg 1x, /hero/landing-golden-1280@2x.webp 2x',
  });
  preload('/hero/landing-golden-md-1536.jpg', {
    as: 'image',
    media: '(min-width: 768px) and (max-width: 1023px)',
    imageSrcSet:
      '/hero/landing-golden-md-1536.jpg 1x, /hero/landing-golden-md-1536@2x.webp 2x',
  });
  preload('/hero/landing-golden-1920.jpg', {
    as: 'image',
    media: '(min-width: 1024px) and (max-width: 1919px)',
    imageSrcSet: '/hero/landing-golden-1920.jpg 1x, /hero/landing-golden-1920@2x.webp 2x',
  });
  preload('/hero/landing-golden-3840.jpg', {
    as: 'image',
    media: '(min-width: 1920px)',
    imageSrcSet: '/hero/landing-golden-3840.jpg 1x, /hero/landing-golden-3840@2x.webp 2x',
  });
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
        {/* Mobile DOES show the whole bus, which it could not before. The box
            here is PORTRAIT — measured 375x732 at 390, h/w 1.952 — so cover
            exposes only 28.8% of the master's width. The previous master's bus
            was 36% and could not fit at any position, so this crop framed only
            the vehicle's front. The current bus is 22.5%, which fits inside that
            window with margin. All four variants come from scripts/hero-cut.py. */}
        {/* Two declarations, on purpose, and they must stay at DIFFERENT cascade
            levels. React's `style` is a JS object, so a duplicate
            `backgroundImage` key is impossible — the usual "plain url() first,
            image-set() second" fallback cannot be written inline. So the class
            carries the 1x fallback and the inline style carries the density
            set: inline wins wherever `image-set()` parses, and where it does not
            the whole declaration is dropped and the class shows through.
            Keep the multi-URL value OUT of the Tailwind arbitrary value — that
            is the escaping trap, and it has no reason to move. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-18 bg-[url('/hero/landing-golden-1280.jpg')] bg-cover bg-center md:hidden lg:-top-21"
          style={{
            backgroundImage:
              "image-set(url('/hero/landing-golden-1280.jpg') 1x, url('/hero/landing-golden-1280@2x.webp') 2x)",
          }}
        />
        {/* md box measures 885x734 at 900 (h/w 0.830). cover shows 67.9% of the
            asset's width and the bus spans 22.5%, so the whole vehicle fits with
            room for the skyline too. The variant is pre-cut to the box aspect
            (1.205 vs 1.205), which is why position is plain centre — there is
            nothing to pan. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-18 hidden bg-[url('/hero/landing-golden-md-1536.jpg')] bg-cover bg-center md:block lg:hidden"
          style={{
            backgroundImage:
              "image-set(url('/hero/landing-golden-md-1536.jpg') 1x, url('/hero/landing-golden-md-1536@2x.webp') 2x)",
          }}
        />
        {/* lg and 3xl use `cover`, not a percentage zoom. The old asset was 2:1
            and needed 138% merely to cover, which is why only ~50% of it was
            ever visible. This master is 1.777, so cover IS the floor and the
            whole frame is in play — the framing is done by position alone.

            These position values depend on pixel-measured landmarks in the
            master. If the photograph is ever swapped, they silently become
            wrong — re-measure before changing the asset:

              bus body    x 0.63 -> 0.855,  tyres y 0.775, floor ~0.79
              sun disc    x 0.114, y 0.472
              trees intrude from the top at x 0.85 -> y 0.397,
                          x 0.90 -> y 0.326,  x 0.946 -> y 0.272,
                          x 0.99 -> y 0.179

            lg spans 1024-1919 and changes character partway: below a box width
            of ~1263 the image is height-constrained (no y travel, only x
            matters) and above it width-constrained (no x travel, only y). One
            declaration covers both.

            x=50% (centred). The previous master needed a RIGHT anchor here: its
            bus rear sat at x 0.95 and the sun at 0.09, spanning 0.86, which does
            not fit the 82.3% of width that cover shows at 1024 — so the sun was
            sacrificed. This master's rear is at 0.855, so the centred window
            [0.0885, 0.9115] holds the whole bus AND the sun. The anchor hack is
            gone; do not reintroduce it without re-checking that span.

            y=48% is for the wide end. At 1920 the visible window is 67.9% of
            image height with 32.1% of travel: the bus floor (0.79) needs
            y >= 34.6% and the tree line under nav content (0.272) caps it at
            60.4%. 48% sits mid-window. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-18 hidden bg-[url('/hero/landing-golden-1920.jpg')] bg-cover bg-[position:50%_48%] lg:-top-21 lg:block 3xl:hidden"
          style={{
            backgroundImage:
              "image-set(url('/hero/landing-golden-1920.jpg') 1x, url('/hero/landing-golden-1920@2x.webp') 2x)",
          }}
        />
        {/* 3xl gets its OWN crop rather than another position value, because
            position alone has an empty solution here: at 2560 the full master
            would need y >= 28.2% to keep the bus floor and <= 21.3% to keep the
            navbar on sky. The asset is pre-cut to the box aspect (2.618 vs
            1905/728 = 2.617), so at 1920 the whole crop is visible and the
            bottom anchor just pins the floor in view. Measured at 1920: navbar
            band lands on master y 0.154-0.232 against a tree line of 0.272, and
            the bus floor 0.790 sits inside 0.833.

            Known limit, do not tune against it: beyond ~2040px of box width the
            visible band can no longer hold both invariants, and tree tips rise
            into the navbar band. It fails in the right order — the bus stays
            whole. Note the navbar is now translucent glass with NO scrim behind
            it (that layer was removed when the active label went dark), so this
            is more visible than it used to be; it is an aesthetic cost at
            ultra-wide, not a legibility one, since the dark labels clear 4.5:1
            against tree tops. Re-check on the render if it ever looks wrong. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-21 hidden bg-[url('/hero/landing-golden-3840.jpg')] bg-cover bg-[position:50%_100%] 3xl:block"
          style={{
            backgroundImage:
              "image-set(url('/hero/landing-golden-3840.jpg') 1x, url('/hero/landing-golden-3840@2x.webp') 2x)",
          }}
        />
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
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-18 bg-gradient-to-b from-white/45 via-white/10 to-white/30 md:hidden lg:-top-21"
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
          className="pointer-events-none absolute inset-x-0 bottom-0 -top-18 opacity-[0.04] mix-blend-overlay lg:-top-21"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        {/* Không còn lớp fade trắng ở đáy hero. Nó từng tồn tại để dải trust bên
            dưới (panel trắng, chromeless) tan vào nền trang. Giờ dải là một băng
            TỐI nằm ĐÈ lên chính đáy ảnh (kiểu Vexere), nên phải còn ảnh ở đó để
            phủ — fade trắng sẽ xoá mất thứ mà băng cần phản chiếu. */}

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
        <div className="relative mx-auto flex w-full max-w-[1920px] flex-col gap-6 px-4 pt-12 pb-16 sm:px-8 sm:pt-16 sm:pb-20 lg:min-h-[610px] lg:pt-14 lg:pb-[72px] xl:px-[104px]">
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
          <div className="flex w-full flex-col gap-4 md:max-w-[560px] lg:max-w-[calc(63vw-60px)] xl:max-w-[min(63vw-132px,13.2vw+828px)]">
            <Card className="w-full rounded-2xl text-left shadow-e4">
              <CardContent className="py-3 xl:px-8 xl:py-5">
                <SearchFormWrapper places={places} />
              </CardContent>
            </Card>
          </div>
        </div>
        {/* Bang trust dat DE len day anh hero, theo mau Vexere. Do tren anh cua ho:
            lay cap mau ngay tren/duoi bien bang tai 4 vi tri x, moi kenh deu x0.5
            -> do la lop phu DEN alpha ~50%, KHONG phai kinh mo. Bang chung khong
            blur: bien thien cua may ben duoi bang van giu khac biet giua cac x
            (94 / 32 / 84); blur se san phang. Cao 69px anh / 1.25 = ~55px CSS,
            noi dung mot dong, khong mo ta.

            Alpha o day KHONG lay 0.5 cua ho. Chu trang can 4.5:1 nen nen sau phu
            phai <= ~118. Ho phu troi xanh 252 -> 126, tuc chinh ho chi dat ~3.9:1.
            Day hero cua ta co mat bien hoang hon rat sang, nen alpha phai do tren
            render that roi chot; 0.6 chi la diem khoi dau.

            Duoi lg: bang nam trong luong (static), luoi 2 cot. Tu lg: absolute de
            day hero. Mot markup, hai vi tri — khong nuoi hai bang mau.

            CANH SANG 1px o mep tren la thu giu cho bang ton tai o nua PHAI. Anh
            hero toi dan sang phai (nhua duong): luminance ngay tren bang di tu
            0.419 (x=280) xuong 0.023 (x=1360). Phu den la phep NHAN, nen o dau
            phai 0.4 x 0.023 = 0.009 va bien bang-vs-anh chi con 1.07:1 — bang
            tan vao mat duong. Da chung minh khong ton tai bang don-luminance nao
            tach duoc ca hai dau (can dong thoi <= 0.106 va >= 0.169: vo nghiem),
            va backdrop-blur/brightness/saturate deu vo dung vi deu la toan tu
            nhan tren vung gan don sac. Nen loi ra chi co: doi SAC, hoac ve CANH.
            Chon ve canh de giu nguyen dien mao.

            Doi tuong so sanh cua canh la LONG BANG, khong phai anh — nho vay no
            deu o moi x: 2.98:1 (x=280) va 3.74:1 (x=1360), tuc manh nhat dung
            cho bac tu nhien da chet. Chu trang giu 6.92:1 vi duong 1px khong nam
            sau chu.

            Dung inset shadow, KHONG dung border-t: chieu cao bang la intrinsic
            (py-3 + 20px noi dung = 44px), them border se doi len 45px va pha con
            so lg:pb-[72px] da tinh cho hero.

            Alpha 0.52 la TRAN CUNG, khong phai khau vi — va con so nay den tu
            mot lan do SAI phai sua. Ban dau uoc anh goc sang nhat duoi bang la
            (248,185,130) lay tu mot mau tai x=280, tinh ra 0.45 con du bien.
            Quet TOAN dai tren render thi diem sang nhat that o x=180 (gan mat
            bien hoang hon), anh goc (251,222,185) — sang hon nhieu o kenh G/B.
            Tai alpha 0.45 chu trang chi con 4.15:1, THUNG san 4.5.

            Quet lai tren anh goc dung: 0.45 -> 4.15 · 0.48 -> 4.58 · 0.50 -> 4.87
            · 0.52 -> 5.19 · 0.60 -> 6.84. Chon 0.52 de con bien ~0.7 cho sai so
            do va cho anh hero neu doi crop. Bai hoc: uoc diem cuc tri tu MOT mau
            thi se hut; phai quet toan vung.

            Icon la TRANG chu khong phai cam, va do la he qua cua viec lam bang
            sang len: icon cam tren nua trai (nen hoang hon cam) tut 2.29 -> 1.45,
            tuc cam-tren-cam gan nhu tan bien. Trang cho 5.20 o nua trai va 17.97
            o nua phai, deu bang chu. Doi lai: bang mat diem nhan cam duy nhat. */}
        <ul
          aria-label="Điểm nổi bật"
          className="relative z-10 grid list-none grid-cols-2 gap-x-6 gap-y-2 bg-black/52 px-4 py-3 text-white sm:px-8 lg:absolute lg:inset-x-0 lg:bottom-0 lg:grid-cols-4 lg:gap-0 lg:px-12 lg:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)]"
        >
          {FEATURES.map(({ icon: Icon, title }) => (
            <li key={title} className="flex items-center justify-center gap-2">
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium">{title}</span>
            </li>
          ))}
        </ul>
      </section>

      <PopularTrips prices={prices} durations={durations} />

      <OperatorShowcase operators={operators} />

      <ContractCarRental />

      <PopularDestinations />

      <NewsletterBand />
    </main>
  );
}
