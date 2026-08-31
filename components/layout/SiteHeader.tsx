'use client';

/**
 * Customer-facing site header. Hidden on operator console (`/op/*`, which has its
 * own (console) sidebar shell), the dev stub-pay page (`/dev/*`), and the auth
 * pages (`/auth/*`, which use the full-bleed AuthSplitLayout shell).
 *
 * Customer auth is live (ADR-021): guests see split "Đăng nhập" (neutral outlined
 * plate) + "Đăng ký" (solid orange) CTAs → /auth/login and /auth/register; signed-in
 * customers see the CustomerAccountMenu (bookings / settings / logout). Sign-in state
 * comes from the client session store (useAuthStatus tri-state).
 *
 * The bar is a fixed-height (68px, `--site-header-h`) frosted-glass surface: translucent cream so the
 * background behind it bleeds up (the hero photo on `/`, cream page elsewhere), with
 * a strong backdrop-blur so scrolling content stays unreadable through it. Only the
 * surface alpha changes on scroll (`.42` → `.55`); no other state.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog } from '@base-ui/react/dialog';
import { MenuIcon, XIcon } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { Logo } from '@/components/brand/Logo';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { CustomerAccountMenu } from '@/components/auth/CustomerAccountMenu';
import { useAuthStatus } from '@/lib/auth/clientSession';
import { cn } from '@/lib/utils';

/* Nav items. "Nhà xe" (operators) removed per redesign — operator signup now lives on
   the "Đăng ký" CTA only. Labels resolve from the `common.nav` catalog at render
   (localized VI/EN); hrefs are locale-agnostic — the next-intl <Link> re-adds the
   active locale prefix. */
const NAV: { href: string; labelKey: string; badge?: string }[] = [
  { href: '/', labelKey: 'nav.bookTicket' },
  { href: '/tro-ly-du-lich', labelKey: 'nav.tripPlanner', badge: 'AI' },
];

/* Customer auth (ADR-021), split into two CTAs. Both routes exist under (customer)/auth.
   `login` is the ghost text button; `register` is the solid orange. */
const LOGIN: { href: string; labelKey: string } = { href: '/auth/login', labelKey: 'auth.login' };
const REGISTER: { href: string; labelKey: string } = { href: '/auth/register', labelKey: 'auth.register' };

/* Solid CTA fill uses `--primary-strong` (orange-700, ~4.7:1 on white), not
   `--primary` (~3.4:1) — the label is below the AA large-text threshold. */
const CTA_CLASS =
  'bg-primary-strong text-primary-foreground shadow-e1 outline-none transition-colors hover:bg-primary-strong/90 focus-visible:ring-3 focus-visible:ring-ring/50';

/* Shared AI badge chrome — same visual treatment (color/border/radius/type) as the
   content-section badge (TripPlannerPromo). Keep that chrome in sync between the two.
   The leading `ml-2` is nav-only: here the badge trails the link text and needs the gap,
   whereas the promo badge already sits in a `gap-2` flex, so it omits `ml-2` deliberately. */
const AI_BADGE_CLASS =
  'ml-2 rounded-full border border-primary-strong/30 bg-primary-tint/60 px-2 py-0.5 text-[12px] font-bold uppercase leading-none tracking-[0.5px] text-primary-strong';

export function SiteHeader() {
  const pathname = usePathname();
  const t = useTranslations('common');
  const authStatus = useAuthStatus();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll(); // deep-linked mid-page loads start scrolled
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  // DD-2: the drawer + backdrop are `md:hidden`, but Base UI's modal Dialog keeps
  // its body scroll-lock while `open`. Resizing/rotating past md with the drawer
  // open would hide all drawer UI yet freeze the page with no way to close it — so
  // close it the moment the layout reaches md (where the inline nav takes over).
  useEffect(() => {
    if (!drawerOpen) return;
    const mq = window.matchMedia('(min-width: 768px)');
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

  return (
    <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
      <header
        className={cn(
          'sticky top-0 z-chrome border-b border-white/45 shadow-[0_1px_0_rgba(28,25,23,0.06)] backdrop-blur-[18px] backdrop-saturate-[1.35] transition-colors duration-200',
          // Frosted cream: translucent so the surface behind (hero photo on /, cream
          // page elsewhere) bleeds up through it; the blur keeps content unreadable
          // while it scrolls under. Alpha lifts once scrolled for a touch more body.
          scrolled ? 'bg-background/55' : 'bg-background/42',
          // No-backdrop-filter fallback: opaque cream.
          'supports-[not_(backdrop-filter:blur(1px))]:bg-[rgba(252,248,244,0.92)]'
        )}
      >
        {/* Flat px-6 (24px gutter) with no max-width container: keeps the logo a
            constant distance from the window edge at every viewport. */}
        <div className="flex h-[var(--site-header-h)] w-full items-center justify-between gap-5 px-6">
          {/* Left cluster: logo + nav packed tight beside it (50px gap), not centred. */}
          <div className="flex items-center">
            <Link
              href="/"
              className="inline-flex shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Logo variant="combo" className="h-[58px] w-auto self-center" />
            </Link>
            <nav className="ml-[50px] hidden items-center gap-0.5 md:flex" aria-label={t('nav.primary')}>
              {NAV.map((item) => {
                // '/' would prefix-match every route, so it needs an exact match.
                const active =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative inline-flex h-[50px] items-center whitespace-nowrap rounded-2xl px-[18px] text-[20px] font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                      // Active underline (spans the label, not the pill: inset-x-[18px] = px-[18px]).
                      // Colour is not the sole active signal (WCAG 1.4.1) — weight + underline carry it.
                      'after:absolute after:inset-x-[18px] after:bottom-[5px] after:h-0.5 after:rounded-full after:bg-primary-strong after:transition-opacity',
                      active
                        ? 'font-semibold text-foreground after:opacity-100'
                        : 'text-foreground/80 after:opacity-0 hover:bg-foreground/5 hover:text-foreground'
                    )}
                  >
                    {t(item.labelKey)}
                    {item.badge && <span className={AI_BADGE_CLASS}>{item.badge}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right cluster (≥ md): language · divider · Đăng nhập · Đăng ký. */}
          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher />
            {authStatus === 'unknown' ? (
              // Neutral placeholder while the bootstrap refresh resolves (DD-4): never
              // the guest CTAs, and not clickable, so a returning signed-in user can't
              // be mis-navigated mid-load.
              <div
                aria-hidden="true"
                className="h-[50px] w-[200px] animate-pulse rounded-2xl bg-muted motion-reduce:animate-none"
              />
            ) : authStatus === 'authed' ? (
              <CustomerAccountMenu />
            ) : (
              <>
                <span aria-hidden="true" className="mx-2 h-[22px] w-px bg-foreground/10" />
                {/* Secondary tier: a neutral outlined plate (not orange — orange stays
                    reserved for the primary CTA). The always-on `bg-background/60` also
                    gives the dark label its own legible surface over the dark hero
                    corner, where a bare-ghost button failed AA at rest. */}
                <Link
                  href={LOGIN.href}
                  className="inline-flex h-[50px] items-center whitespace-nowrap rounded-2xl border border-border/80 bg-background/60 px-[18px] text-[19px] font-semibold text-foreground shadow-sm outline-none transition-colors hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {t(LOGIN.labelKey)}
                </Link>
                <Link
                  href={REGISTER.href}
                  className={cn(
                    'inline-flex h-[50px] items-center whitespace-nowrap rounded-2xl px-[28px] text-[19px] font-semibold',
                    CTA_CLASS
                  )}
                >
                  {t(REGISTER.labelKey)}
                </Link>
              </>
            )}
          </div>

          {/* Mobile action cluster (< md): solid Đăng ký (guests) + drawer trigger.
              Đăng nhập, the two nav links, and the language switcher move into the drawer. */}
          <div className="flex items-center gap-2.5 md:hidden">
            {authStatus === 'guest' && (
              <Link
                href={REGISTER.href}
                className={cn(
                  'inline-flex h-[50px] items-center whitespace-nowrap rounded-2xl px-[28px] text-[19px] font-semibold',
                  CTA_CLASS
                )}
              >
                {t(REGISTER.labelKey)}
              </Link>
            )}
            <Dialog.Trigger
              aria-label={t('header.openMenu')}
              className="inline-flex size-[50px] items-center justify-center rounded-2xl bg-background/60 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <MenuIcon className="size-6" />
            </Dialog.Trigger>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-overlay-backdrop bg-black/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none md:hidden" />
        <Dialog.Popup
          className="fixed inset-y-0 right-0 z-overlay-panel flex w-72 flex-col bg-background shadow-lg transition-transform duration-200 ease-out outline-none data-[ending-style]:translate-x-full data-[ending-style]:duration-150 data-[starting-style]:translate-x-full motion-reduce:transition-none md:hidden"
        >
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <Dialog.Title>
              <Logo variant="combo" className="h-9 w-auto" />
            </Dialog.Title>
            <Dialog.Close
              aria-label={t('header.closeMenu')}
              className="inline-flex size-11 items-center justify-center rounded-md outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <XIcon className="size-5" />
            </Dialog.Close>
          </div>
          <nav aria-label={t('nav.primary')} className="flex-1 overflow-y-auto px-2 py-2">
            {NAV.map((item) => {
              const active =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
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
                  {t(item.labelKey)}
                  {item.badge && <span className={AI_BADGE_CLASS}>{item.badge}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center justify-center border-t border-border px-2 py-3">
            <LanguageSwitcher onNavigate={() => setDrawerOpen(false)} />
          </div>
          <div className="flex justify-center border-t border-border px-2 py-2">
            {authStatus === 'unknown' ? (
              <div
                aria-hidden="true"
                className="h-11 w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
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
                className="flex h-11 w-full items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t(LOGIN.labelKey)}
              </Link>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
