'use client';

/**
 * Customer-facing site header. Hidden on operator console (`/op/*`, which has its
 * own (console) sidebar shell) and on the dev stub-pay page (`/dev/*`).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Trang chủ' },
  { href: '/search', label: 'Tìm chuyến xe' },
  { href: '/account/bookings', label: 'Tài khoản' },
];

export function SiteHeader() {
  const pathname = usePathname();
  if (pathname.startsWith('/op') || pathname.startsWith('/dev')) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo variant="combo" />
        </Link>
        <nav className="flex items-center gap-1 text-sm" aria-label="Điều hướng chính">
          {NAV.map((item) => {
            const active =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 font-medium transition-colors',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
