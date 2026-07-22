'use client';

/**
 * Customer-facing site header. Hidden on operator console (`/op/*`, which has its
 * own (console) sidebar shell), the dev stub-pay page (`/dev/*`), and the auth
 * pages (`/auth/*`, which use the full-bleed AuthSplitLayout shell).
 *
 * Phase 1: customer accounts paused (guest-only). "Đăng nhập" points to
 * operator login (/op/login). Restore CustomerAccountMenu + /auth/login when
 * customer auth is enabled in Phase 2.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog } from '@base-ui/react/dialog';
import { ChevronDown, LogInIcon, MenuIcon, XIcon } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

/* Nav mirrors the mockup's five items (docs/design/mockup-home.png S1). */
const NAV = [
  { href: '/', label: 'Đặt vé xe' },
  { href: '/lien-he-dat-xe', label: 'Thuê xe hợp đồng' },
  { href: '/op/register', label: 'Nhà xe' },
  // Imperfect mapping: no guide page exists yet; the cancellation/refund policy is
  // the closest real destination. Replace when a real "Hướng dẫn" page ships.
  { href: '/chinh-sach-huy-ve-hoan-tien', label: 'Hướng dẫn' },
  { href: '/khieu-nai', label: 'Hỗ trợ' },
];

/* The mockup's label is "Đăng nhập / Đăng ký", but customer auth is 410-gated in
   Phase 1 (proxy.ts). The button keeps the mockup's outlined treatment and points at
   operator login — the only login that exists. */
const LOGIN = { href: '/op/login', label: 'Đăng nhập / Đăng ký' };

/* Solid CTA fill uses `--primary-strong` (orange-700, ~4.7:1 on white), not
   `--primary` (~3.4:1) — the label is below the AA large-text threshold. */
const CTA_CLASS =
  'bg-primary-strong text-primary-foreground shadow-e1 outline-none transition-all hover:bg-primary-strong/90 active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50';

export function SiteHeader() {
  const pathname = usePathname();
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
      const headerH = window.innerWidth >= 1024 ? 84 : 72;
      setOverHero(hero.getBoundingClientRect().bottom > headerH);
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
      const headerH = window.innerWidth >= 1024 ? 84 : 72;
      observer = new IntersectionObserver(
        ([entry]) => setOverHero(entry.isIntersecting),
        { rootMargin: `-${headerH}px 0px 0px 0px`, threshold: 0 }
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

  if (pathname.startsWith('/op') || pathname.startsWith('/dev') || pathname.startsWith('/auth') || pathname.startsWith('/admin'))
    return null;

  return (
    <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
      <header
        className={cn(
          'sticky top-0 z-40 transition-[background-color,box-shadow] duration-200',
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
            // 0.45 is as opaque as it needs to be and no more. Over the sky in
            // this band (~RGB 173) it composites to ~210, where the dark labels
            // measure ~8.9:1; even against the darkest content that reaches the
            // bar at 2560 (tree tops, ~RGB 60) it still clears 4.5:1. This only
            // works because the active label is dark — an orange one would need
            // ~RGB 243 behind it and force the bar back to near-white. See the
            // nav-link classes below before raising either.
            //
            // The feather stays off: it exists to fade an OPAQUE bar into the
            // photo, and against a translucent bar it reads as a smear.
            ? 'bg-background/45 backdrop-blur-md after:opacity-0'
            : scrolled
              ? 'bg-background/90 shadow-e1 backdrop-blur after:opacity-0'
              : 'bg-background'
        )}
      >
        {/* Flat px-6 with no max-width container: keeps the logo a constant 24px
            from the window edge at every viewport (a max-w container re-centres
            above its cap and the gutter grows unbounded). */}
        {/* lg:h-21 (84px) = 5.83% of a 1440 viewport, matching the reference bar's
            measured 5.88%. The old h-24 ran ~14% proportionally tall. */}
        <div className="flex h-18 w-full items-center justify-between gap-4 px-6 lg:h-21">
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
            <nav className="ml-16 flex items-center gap-4 text-sm" aria-label="Điều hướng chính">
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
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-5">
              {/* Language pill — visual only. There is no i18n in the app; it renders
                  because the reference has it, and it stays inert + aria-hidden so
                  assistive tech is never told a control exists.
                  ⚠ The chevron is restored for visual fidelity with the reference,
                  but it does promise a dropdown that does not exist — a known
                  misleading affordance for sighted users. Resolve when i18n ships
                  or the pill becomes real.
                  h-11 matches the button: the reference sizes the two within 1px,
                  where ours had the pill 18% shorter. */}
              <span
                aria-hidden="true"
                className="inline-flex h-11 select-none items-center gap-1.5 rounded-full bg-card px-3 text-sm font-medium text-foreground"
              >
                {/* Vietnam flag, not a globe — the reference shows a red disc with a
                    yellow star. Lucide ships no such icon, so it is inlined rather
                    than adding an asset. */}
                <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden="true">
                  <circle cx="8" cy="8" r="8" fill="#DA251D" />
                  <path
                    fill="#FF0"
                    d="M8 3.2l1.176 3.62h3.806l-3.079 2.237 1.176 3.62L8 10.44l-3.079 2.237 1.176-3.62L3.018 6.82h3.806z"
                  />
                </svg>
                VI
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </span>
              <Link
                href={LOGIN.href}
                className={cn(
                  // border-primary/40: the reference's stroke samples (251,113,77),
                  // far more saturated than /30 composites to. JPEG blur can only
                  // wash a thin stroke toward its neighbour, so that is a floor.
                  // bg-card, not a transparent interior: the scrim has faded to
                  // ~0 this far right, so the label would otherwise sit on raw
                  // sky pixels. The reference's own button carries a fill too.
                  'inline-flex h-11 items-center whitespace-nowrap rounded-lg border border-primary/40 bg-card px-5 text-base font-medium text-foreground outline-none transition-colors hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50'
                )}
              >
                {LOGIN.label}
              </Link>
            </div>
          </div>

          {/* Mobile action cluster — login CTA + drawer trigger, both right-aligned */}
          <div className="flex items-center gap-2 xl:hidden">
            <Link
              href={LOGIN.href}
              aria-label={LOGIN.label}
              className={cn(
                'inline-flex size-11 items-center justify-center rounded-full',
                CTA_CLASS
              )}
            >
              <LogInIcon className="size-5" />
            </Link>
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
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 xl:hidden" />
        <Dialog.Popup
          className="fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-background shadow-lg transition-transform duration-200 ease-out outline-none data-[ending-style]:translate-x-full data-[ending-style]:duration-150 data-[starting-style]:translate-x-full xl:hidden"
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
                    'flex min-h-11 items-center rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                    active
                      ? 'font-semibold text-primary-strong'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border px-2 py-2">
            <Link
              href={LOGIN.href}
              onClick={() => setDrawerOpen(false)}
              className={cn(
                'flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium',
                CTA_CLASS
              )}
            >
              <LogInIcon className="size-4" />
              {LOGIN.label}
            </Link>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
