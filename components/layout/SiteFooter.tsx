'use client';

/**
 * Customer-facing site footer. Hidden on operator console (`/op/*`) and dev
 * stub-pay (`/dev/*`) — same scope as SiteHeader.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith('/op') || pathname.startsWith('/dev')) return null;

  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-border bg-muted/40">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Logo variant="combo" />
          <p>Đặt vé xe khách liên tỉnh trên toàn quốc.</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Liên kết chân trang">
          <Link href="/search" className="hover:text-foreground">
            Tìm chuyến xe
          </Link>
          <Link href="/auth/login" className="hover:text-foreground">
            Đăng nhập
          </Link>
          <Link href="/account/bookings" className="hover:text-foreground">
            Vé của tôi
          </Link>
        </nav>
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © {year} BBVN
      </div>
    </footer>
  );
}
