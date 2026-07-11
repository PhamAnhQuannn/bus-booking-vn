'use client';

/**
 * Customer-facing site footer. Hidden on operator console (`/op/*`), dev
 * stub-pay (`/dev/*`), and auth pages (`/auth/*`) — same scope as SiteHeader.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';

// 2026-06-06: customer accounts paused (guest-only). "Tài khoản" removed; "Đăng nhập"
// now points at the operator login (/op/login) — only operators log in. "Trở thành
// đối tác" routes operators to the application form.
const FOOTER_LINKS = {
  main: [
    { href: '/lien-he-dat-xe', label: 'Liên hệ đặt xe' },
    { href: '/op/register', label: 'Trở thành đối tác' },
    { href: '/op/login', label: 'Đăng nhập' },
  ],
  legal: [
    { href: '/terms', label: 'Điều khoản dịch vụ' },
    { href: '/privacy', label: 'Chính sách bảo mật' },
  ],
  support: [
    { href: '/chinh-sach-huy-ve-hoan-tien', label: 'Chính sách hủy/hoàn vé' },
    { href: '/khieu-nai', label: 'Giải quyết khiếu nại' },
  ],
} as const;

const linkClass =
  'inline-flex min-h-9 items-center rounded-md outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50';

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith('/op') || pathname.startsWith('/dev') || pathname.startsWith('/auth') || pathname.startsWith('/admin'))
    return null;

  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-border bg-muted/40">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <div className="flex max-w-xs flex-col gap-2">
          <Logo variant="combo" />
          <p>Đặt vé xe khách liên tỉnh trên toàn quốc.</p>
          <Link href="/khieu-nai" className={linkClass + ' font-medium text-foreground'}>
            Hỗ trợ
          </Link>
        </div>
        <div className="flex flex-wrap gap-x-12 gap-y-6">
          <nav className="flex flex-col gap-2" aria-label="Liên kết">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Đặt vé</span>
            {FOOTER_LINKS.main.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass}>
                {l.label}
              </Link>
            ))}
          </nav>
          <nav className="flex flex-col gap-2" aria-label="Pháp lý">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Pháp lý</span>
            {FOOTER_LINKS.legal.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass}>
                {l.label}
              </Link>
            ))}
          </nav>
          <nav className="flex flex-col gap-2" aria-label="Hỗ trợ & Khiếu nại">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Hỗ trợ & Khiếu nại</span>
            {FOOTER_LINKS.support.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © {year} BBVN
      </div>
    </footer>
  );
}
