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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll(); // deep-linked mid-page loads start scrolled
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
          scrolled
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
                      active
                        ? 'font-semibold text-primary-strong after:opacity-100'
                        // Reference renders inactive items pure #000; text-foreground
                        // is our nearest token and raises contrast over the old
                        // muted grey. Active stays distinguishable via orange + rule.
                        : 'text-foreground after:opacity-0 hover:text-primary-strong group-hover:after:opacity-40'
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
                  'inline-flex h-11 items-center whitespace-nowrap rounded-lg border border-primary/40 px-5 text-base font-medium text-foreground outline-none transition-colors hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50'
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
