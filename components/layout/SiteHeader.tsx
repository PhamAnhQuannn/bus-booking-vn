'use client';

/**
 * Customer-facing site header. Hidden on operator console (`/op/*`, which has its
 * own (console) sidebar shell), the dev stub-pay page (`/dev/*`), and the auth
 * pages (`/auth/*`, which use the full-bleed AuthSplitLayout shell).
 *
 * Customer auth is live (ADR-021): guests see "Đăng nhập / Đăng ký" → /auth/login;
 * signed-in customers see the CustomerAccountMenu (bookings / settings / logout).
 * Sign-in state comes from the client session store (useAuthStatus tri-state).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog } from '@base-ui/react/dialog';
import { LogInIcon, MenuIcon, XIcon } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { CustomerAccountMenu } from '@/components/auth/CustomerAccountMenu';
import { useAuthStatus } from '@/lib/auth/clientSession';
import { cn } from '@/lib/utils';

/* Nav items (docs/design/mockup-home.png S1). "Hướng dẫn" + "Hỗ trợ" removed per request. */
const NAV = [
  { href: '/', label: 'Đặt vé xe' },
  { href: '/tro-ly-du-lich', label: 'Trợ lý du lịch', badge: 'AI' },
  { href: '/op/register', label: 'Nhà xe' },
];

/* Customer login (ADR-021). Operators reach their console from the "Nhà xe" nav item. */
const LOGIN = { href: '/auth/login', label: 'Đăng nhập / Đăng ký' };

/* Solid CTA fill uses `--primary-strong` (orange-700, ~4.7:1 on white), not
   `--primary` (~3.4:1) — the label is below the AA large-text threshold. */
const CTA_CLASS =
  'bg-primary-strong text-primary-foreground shadow-e1 outline-none transition-all hover:bg-primary-strong/90 active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50';

/* The bar's own height, mirroring the `h-18 lg:h-21` classes on the inner row
   below. Both the scroll handler and the IntersectionObserver's rootMargin need
   it in JS, so it lives here rather than being written out twice — three places
   had to agree and nothing enforced it. If those classes change, change this. */
const BAR_H_PX = { base: 72, lg: 84 } as const;
const barHeight = () => (window.innerWidth >= 1024 ? BAR_H_PX.lg : BAR_H_PX.base);

export function SiteHeader() {
  const pathname = usePathname();
  const authStatus = useAuthStatus();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  /* True only while a hero photograph is actually behind the bar. Three states
     exist now — over-photo-at-rest, over-photo-scrolled, and past-the-hero — and
     the old `scrollY > 8` boolean collapsed the first two into the third, which
     would flash an opaque white bar over the photo 8px into a 640px hero. */
  const [overHero, setOverHero] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      /* Second, independent read of the same question the observer below
         answers. The two cover each other: the observer is authoritative during
         continuous scrolling, while this catches instant jumps, where a large
         programmatic scrollTo was measured leaving the bar transparent over page
         content. Both are cheap and idempotent, and React drops same-value
         updates, so the redundancy costs nothing. */
      const hero = document.getElementById('search');
      if (!hero) return;
      setOverHero(hero.getBoundingClientRect().bottom > barHeight());
    };
    onScroll(); // deep-linked mid-page loads start scrolled
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  useEffect(() => {
    /* Whether a hero photograph is behind the bar is tracked with an
       IntersectionObserver rather than a rect read inside the scroll handler.
       Scroll events coalesce, and a single one (an anchor jump, the End key, a
       restored scroll position) can be serviced before layout settles — measured
       live, that left the bar stuck transparent for >1.5s with page content
       visible underneath it. The observer reports the crossing itself, so it
       cannot go stale.

       Presence of #search also settles which branch of `/` rendered: the hero
       view has it, the search-results view does not. That distinction cannot
       come from `usePathname()` alone, and `useSearchParams()` is not an option
       here — this component mounts in the root layout, where it triggers the CSR
       bailout that broke `notFound()` status codes once already (mistake log,
       2026-07-17). */
    // No hero on this route: nothing to observe. State already defaults to
    // false, and leaving a hero route resets it via this effect's cleanup — so
    // there is no synchronous setState in the effect body to cascade renders.
    const hero = document.getElementById('search');
    if (!hero) return;
    let observer: IntersectionObserver | null = null;
    const attach = () => {
      observer?.disconnect();
      // Shrink the viewport by the bar's own height: the hero counts as "behind
      // the bar" only while it still reaches below that inset.
      observer = new IntersectionObserver(
        ([entry]) => setOverHero(entry.isIntersecting),
        { rootMargin: `-${barHeight()}px 0px 0px 0px`, threshold: 0 }
      );
      observer.observe(hero);
    };
    attach();
    window.addEventListener('resize', attach);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', attach);
      setOverHero(false); // navigating away from the hero route
    };
  }, [pathname]);

  // DD-2: the drawer + backdrop are `xl:hidden`, but Base UI's modal Dialog keeps
  // its body scroll-lock while `open`. Resizing/rotating past xl with the drawer
  // open would hide all drawer UI yet freeze the page with no way to close it — so
  // close it the moment the layout reaches xl (where the inline nav takes over).
  useEffect(() => {
    if (!drawerOpen) return;
    const mq = window.matchMedia('(min-width: 1280px)');
    const sync = () => {
      if (mq.matches) setDrawerOpen(false);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [drawerOpen]);

  // DD-8: in-drawer links already close on click (forward nav). Browser
  // back/forward fire `popstate` instead, which those handlers can't catch — so
  // close the drawer here too, or it lingers over the destination page.
  useEffect(() => {
    const onPop = () => setDrawerOpen(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (pathname.startsWith('/op') || pathname.startsWith('/dev') || pathname.startsWith('/auth') || pathname.startsWith('/admin'))
    return null;

  // App-shell mode trên trợ lý du lịch: bar thấp hơn (56/64) để bớt "marketing" + trả chiều cao cho workspace.
  const compact = pathname.startsWith('/tro-ly-du-lich');

  return (
    <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
      <header
        className={cn(
          'sticky top-0 z-chrome transition-[background-color,box-shadow] duration-200',
          // Bottom feather: bleeds the header surface 48px down over whatever sits
          // below, so the bar has no hard edge against the hero photo. Starts at full
          // `from-background` — any alpha step at the bar's own bottom edge would
          // re-create the hairline this replaces. Eased via `background/40` so the
          // falloff reads as light bloom rather than a linear smudge.
          'after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-12 after:bg-gradient-to-b after:from-background after:via-background/40 after:to-transparent after:transition-opacity after:duration-200',
          overHero
            // Over the hero photo the bar is frosted glass: translucent surface
            // plus backdrop blur, so the sky and clouds read through it.
            //
            // 0.40 (lowered from 0.45 on user request for a bit more glass). Over
            // the sky in this band (~RGB 173) it composites to ~208, where the dark
            // labels still measure ~8.8:1; over the darkest content that reaches the
            // bar at 2560 (tree tops, ~RGB 60) contrast tightens toward the 4.5:1 AA
            // floor, so `backdrop-blur-md` is load-bearing here — it averages the
            // backdrop and lifts the worst-case local contrast. Do not lower further
            // without re-measuring on the render. This only
            // works because the active label is dark — an orange one would need
            // ~RGB 243 behind it and force the bar back to near-white. See the
            // nav-link classes below before raising either.
            //
            // The feather stays off: it exists to fade an OPAQUE bar into the
            // photo, and against a translucent bar it reads as a smear.
            ? 'bg-background/40 backdrop-blur-md after:opacity-0'
            : scrolled
              ? 'bg-background/82 shadow-e1 backdrop-blur after:opacity-0'
              : 'bg-background',
          // App-shell routes (trợ lý du lịch): the bar is chrome above a workspace, not
          // a marketing header melting into a hero. Give it a crisp bottom edge + drop
          // shadow so the session below reads as a separate surface; kill the feather
          // (it only exists to soften an edge into a photo, which there is none here).
          compact && 'border-b border-border shadow-e1 after:opacity-0'
        )}
      >
        {/* Flat px-6 with no max-width container: keeps the logo a constant 24px
            from the window edge at every viewport (a max-w container re-centres
            above its cap and the gutter grows unbounded). */}
        {/* lg:h-21 (84px) = 5.83% of a 1440 viewport, matching the reference bar's
            measured 5.88%. The old h-24 ran ~14% proportionally tall. */}
        <div className={cn('flex w-full items-center justify-between gap-4 px-6', compact ? 'h-14 lg:h-16' : 'h-18 lg:h-21')}>
          {/* Logo owns the left slot at every breakpoint so its 24px gutter is
              uniform; the hamburger sits in the right-hand mobile cluster.
              h-11 at lg = 44px ≈ 52% of the 84px bar, matching the reference's
              50.5%; the previous h-18 filled 75% and read oversized. Our mark
              also carries a "BUS BOOKING" tagline the reference has no
              equivalent for — it is baked into the PNG, so scale is the only
              lever without commissioning a new asset. */}
          <Link href="/" className="inline-flex min-h-11 shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Logo variant="combo" className="h-9 w-auto lg:h-11" />
          </Link>

          {/* Three-zone bar, matching the mockup's measured geometry: nav packed next
              to the logo (logo→nav1 ≈6.4% of width, uniform ≈3.3% inter-nav rhythm),
              then one large flex space (`ml-auto`) before the tightly-paired pill +
              button (≈1.3% apart). `flex-1` absorbs the container's justify-between
              so all slack lands inside this wrapper, not after the logo.
              xl (not md/lg): measured live, logo + five items + pill + button need
              ~1240px of viewport at this scale — at 1024 the button label wraps to
              four lines and flex squashes the logo. The drawer covers below xl. */}
          <div className="hidden flex-1 items-center xl:flex">
            {/* ml-16 + the container's gap-4 + the first link's px-3 = 92px visual
                gap at 1440 ≈ the mockup's 6.4%-of-width logo→nav spacing. */}
            {/* text-sm, not text-base: cap-heights already matched the reference,
                so the cluster's 5.8pp width overshoot was relative type size —
                the reference's ~17px on an 1828 frame scales to ~13.4px here.
                This also lands "VI" at nav size and keeps the button label one
                step larger than the nav, both as measured. */}
            <nav className="ml-16 flex items-center gap-4 text-lg" aria-label="Điều hướng chính">
              {NAV.map((item) => {
                // '/' would prefix-match every route, so it needs an exact match.
                const active =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                      // Underline bar so the active state is not signalled by colour alone
                      // (WCAG 1.4.1) — deliberate improvement over the mockup, which
                      // signals active by colour only.
                      'after:absolute after:inset-x-3 after:bottom-2 after:h-0.5 after:rounded-full after:bg-primary after:transition-opacity',
                      // Active is signalled by WEIGHT + the orange underline, not by
                      // orange text. That is what lets the bar be real glass over
                      // the hero: #CA3500 has relative luminance 0.151 and needs its
                      // backdrop at L >= 0.855 (~RGB 243) for 4.5:1, so an orange
                      // label forces a near-white bar no matter how the glass alpha
                      // is set. Dark text clears the same bar at ~7:1 even over the
                      // darkest sky in the band, so the surface is free to be
                      // transparent. Colour is still not the sole active signal
                      // (WCAG 1.4.1) — the underline carries it.
                      active
                        ? 'font-semibold text-foreground after:opacity-100'
                        : 'text-foreground/80 after:opacity-0 hover:text-foreground group-hover:after:opacity-40'
                    )}
                  >
                    {item.label}
                    {item.badge && (
                      <span className="ml-1.5 rounded bg-primary-strong px-1 py-px text-[10px] font-bold uppercase leading-none tracking-wide text-primary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-5">
              {/* 2026-07-30: an inert "VI" language pill sat here — a flag, the label,
                  and a chevron promising a dropdown that did not exist. The app has no
                  i18n and is Vietnamese-only, so the control could never do anything.
                  Its own comment already called it "a known misleading affordance".
                  Restore it alongside real i18n, not before. */}
              {authStatus === 'unknown' ? (
                // Neutral placeholder while the bootstrap refresh resolves (DD-4):
                // never the guest CTA, and not clickable, so a returning signed-in
                // user can't be mis-navigated to /auth/login mid-load.
                <div
                  aria-hidden="true"
                  className="h-11 w-32 animate-pulse rounded-full bg-muted motion-reduce:animate-none"
                />
              ) : authStatus === 'authed' ? (
                <CustomerAccountMenu />
              ) : (
                <Link
                  href={LOGIN.href}
                  className={cn(
                    // border-primary/40: the reference's stroke samples (251,113,77),
                    // far more saturated than /30 composites to. JPEG blur can only
                    // wash a thin stroke toward its neighbour, so that is a floor.
                    // bg-card, not a transparent interior: the scrim has faded to
                    // ~0 this far right, so the label would otherwise sit on raw
                    // sky pixels. The reference's own button carries a fill too.
                    'inline-flex h-11 items-center whitespace-nowrap rounded-lg border border-primary/70 bg-card px-5 text-xl font-medium text-primary-strong outline-none transition-colors hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50'
                  )}
                >
                  {LOGIN.label}
                </Link>
              )}
            </div>
          </div>

          {/*
            Mobile action cluster — drawer trigger only (#369 / #349).

            There used to be a second button here: an icon-only, solid-orange pill
            linking to /op/login. Two problems, both on the viewport that carries almost
            all Vietnamese traffic:

            1. The "Đăng nhập nhà xe" relabel that #349 shipped renders only at xl and
               above. Below that the label existed solely as aria-label, so a sighted
               customer tapped an unlabelled orange button — the most prominent control
               in the header — and landed on "Đăng nhập — Quản trị viên / VD: PB-0001".
            2. #349 asked for two remedies and only got one. The second was to stop
               giving an operator-only action top-level placement on a customer-facing
               site. This is that half.

            Labelling it in place was the alternative, but the header's own measurements
            (see the xl:flex comment above) show the label already wraps at 1024px; a
            17-character pill beside a hamburger at 390px is worse, not better.

            Operators lose nothing but one tap: the drawer below carries the same link
            with its label visible, which is where an unlabelled icon should have been
            sending people all along.
          */}
          <div className="flex items-center gap-2 xl:hidden">
            <Dialog.Trigger
              aria-label="Mở menu điều hướng"
              className="inline-flex size-11 items-center justify-center rounded-md outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <MenuIcon className="size-5" />
            </Dialog.Trigger>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-overlay-backdrop bg-black/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none xl:hidden" />
        <Dialog.Popup
          className="fixed inset-y-0 right-0 z-overlay-panel flex w-72 flex-col bg-background shadow-lg transition-transform duration-200 ease-out outline-none data-[ending-style]:translate-x-full data-[ending-style]:duration-150 data-[starting-style]:translate-x-full motion-reduce:transition-none xl:hidden"
        >
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <Dialog.Title>
              <Logo variant="combo" />
            </Dialog.Title>
            <Dialog.Close
              aria-label="Đóng menu"
              className="inline-flex size-11 items-center justify-center rounded-md outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <XIcon className="size-5" />
            </Dialog.Close>
          </div>
          <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto px-2 py-2">
            {NAV.map((item) => {
              const active =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center rounded-md px-3 text-base font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                    active
                      ? 'font-semibold text-primary-strong'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {item.label}
                  {item.badge && (
                    <span className="ml-1.5 rounded bg-primary-strong px-1 py-px text-[10px] font-bold uppercase leading-none tracking-wide text-primary-foreground">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="flex justify-center border-t border-border px-2 py-2">
            {authStatus === 'unknown' ? (
              <div
                aria-hidden="true"
                className="h-11 w-full animate-pulse rounded-full bg-muted motion-reduce:animate-none"
              />
            ) : authStatus === 'authed' ? (
              // QA-H2: close the drawer when the account menu navigates or logs out —
              // the header lives in the root layout, so the drawer wouldn't otherwise
              // close over the destination.
              <CustomerAccountMenu onNavigate={() => setDrawerOpen(false)} />
            ) : (
              <Link
                href={LOGIN.href}
                onClick={() => setDrawerOpen(false)}
                className={cn(
                  'flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-medium',
                  CTA_CLASS
                )}
              >
                <LogInIcon className="size-4" />
                {LOGIN.label}
              </Link>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
