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
import { LogInIcon, MenuIcon, XIcon } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/lien-he-dat-xe', label: 'Liên hệ đặt xe' },
  { href: '/op/register', label: 'Trở thành đối tác' },
];

const LOGIN = { href: '/op/login', label: 'Đăng nhập nhà xe' };

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
        <div className="flex h-18 w-full items-center justify-between gap-4 px-6 lg:h-24">
          {/* Logo owns the left slot at every breakpoint so its 24px gutter is
              uniform; the hamburger sits in the right-hand mobile cluster. */}
          <Link href="/" className="inline-flex min-h-11 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Logo variant="combo" className="h-14 w-auto lg:h-18" />
          </Link>

          {/* Right zone — nav links + CTA clustered together. Two links cannot hold
              the centre of a wide viewport; the empty middle read as dead surface. */}
          <div className="hidden items-center gap-1 md:flex lg:gap-2">
            {/* 18px only from lg: at 768 the cluster has just 15px of slack at 18px,
                which any label edit would break. 16px there keeps 64px of slack. */}
            <nav className="flex items-center gap-1 text-base lg:gap-2 lg:text-lg" aria-label="Điều hướng chính">
              {NAV.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative inline-flex min-h-11 items-center rounded-md px-3 font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                      // Underline bar so the active state is not signalled by colour alone (WCAG 1.4.1)
                      'after:absolute after:inset-x-3 after:bottom-2 after:h-0.5 after:rounded-full after:bg-primary after:transition-opacity',
                      active
                        ? 'font-semibold text-primary after:opacity-100'
                        : 'text-muted-foreground after:opacity-0 hover:text-foreground group-hover:after:opacity-40'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <Link
              href={LOGIN.href}
              className={cn(
                'ml-3 inline-flex h-11 items-center rounded-full px-5 text-base font-medium lg:ml-5 lg:text-lg',
                CTA_CLASS
              )}
            >
              {LOGIN.label}
            </Link>
          </div>

          {/* Mobile action cluster — login CTA + drawer trigger, both right-aligned */}
          <div className="flex items-center gap-2 md:hidden">
            <Link
              href={LOGIN.href}
              aria-label={LOGIN.label}
              className={cn(
                'inline-flex size-10 items-center justify-center rounded-full',
                CTA_CLASS
              )}
            >
              <LogInIcon className="size-5" />
            </Link>
            <Dialog.Trigger
              aria-label="Mở menu điều hướng"
              className="inline-flex size-10 items-center justify-center rounded-md outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <MenuIcon className="size-5" />
            </Dialog.Trigger>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 md:hidden" />
        <Dialog.Popup
          className="fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-background shadow-lg transition-transform duration-200 ease-out outline-none data-[ending-style]:translate-x-full data-[ending-style]:duration-150 data-[starting-style]:translate-x-full md:hidden"
        >
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <Dialog.Title>
              <Logo variant="combo" />
            </Dialog.Title>
            <Dialog.Close
              aria-label="Đóng menu"
              className="inline-flex size-9 items-center justify-center rounded-md outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <XIcon className="size-5" />
            </Dialog.Close>
          </div>
          <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto px-2 py-2">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                    active
                      ? 'font-semibold text-primary'
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
