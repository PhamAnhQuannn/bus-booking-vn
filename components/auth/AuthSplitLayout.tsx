import type { ReactNode } from 'react';
import Link from 'next/link';
import { ShieldCheck, Bus, Wallet, BarChart3, Ticket } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

const logoLinkClass =
  'inline-flex w-fit rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * Split-panel auth shell (design: docs/design/auth-redesign-20260527.md, design-language v1.0).
 *
 * Desktop (≥md): brand panel beside the form panel. Mobile: form panel only + a slim
 * brand bar. `audience` swaps the brand panel surface + copy so customers and operators
 * land on visibly distinct doors while sharing one structural family.
 *
 * No client hooks — safe to compose inside the 'use client' auth pages.
 */

type Audience = 'customer' | 'operator';

const CONTENT: Record<
  Audience,
  {
    eyebrow: string | null;
    headline: string;
    bullets: { icon: typeof Bus; label: string }[];
    panel: string;
    ink: string;
    inkMuted: string;
    fineprint: string;
    monoLogo: boolean;
  }
> = {
  customer: {
    eyebrow: null,
    headline: 'Đặt vé xe khách liên tỉnh — nhanh, an toàn.',
    bullets: [
      { icon: ShieldCheck, label: 'Giữ chỗ tức thì khi đặt vé' },
      { icon: Bus, label: 'Hàng nghìn chuyến mỗi ngày' },
      { icon: Wallet, label: 'Thanh toán an toàn, minh bạch' },
    ],
    panel: 'bg-gradient-to-br from-primary to-primary/80',
    ink: 'text-primary-foreground',
    inkMuted: 'text-primary-foreground/80',
    fineprint: 'Vé xe khách trên toàn quốc.',
    monoLogo: true,
  },
  operator: {
    eyebrow: 'Cổng nhà xe',
    headline: 'Cổng quản trị nhà xe',
    bullets: [
      { icon: Bus, label: 'Quản lý chuyến & đội xe' },
      { icon: BarChart3, label: 'Theo dõi doanh thu' },
      { icon: Ticket, label: 'Xử lý đặt vé của khách' },
    ],
    // Dark warm panel — distinct back-office surface, clearly not the consumer orange.
    panel: 'bg-gradient-to-br from-foreground to-foreground/90',
    ink: 'text-background',
    inkMuted: 'text-background/70',
    fineprint: 'Dành cho nhà xe đối tác.',
    monoLogo: true,
  },
};

export function AuthSplitLayout({
  audience,
  title,
  subtitle,
  children,
}: {
  audience: Audience;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const c = CONTENT[audience];

  return (
    <main className="grid min-h-svh md:grid-cols-[1.1fr_1fr] lg:grid-cols-[1.25fr_1fr]">
      {/* Brand panel — desktop only */}
      <aside
        className={cn(
          'relative hidden flex-col justify-between overflow-hidden p-10 md:flex lg:p-14',
          c.panel
        )}
      >
        {/* decorative route motif (origin dot → orange path → arrowhead, echoing the logo) */}
        <svg
          viewBox="0 0 200 200"
          aria-hidden="true"
          fill="none"
          className={cn('pointer-events-none absolute -right-10 -bottom-10 size-80 opacity-[0.12]', c.ink)}
        >
          <circle cx="40" cy="100" r="10" fill="currentColor" />
          <path d="M55 100 H130" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
          <path
            d="M128 76 L172 100 L128 124"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="relative flex flex-col gap-1">
          <Link href="/" aria-label="Về trang chủ BBVN" className={logoLinkClass}>
            <Logo variant="combo" mono={c.monoLogo} className={c.monoLogo ? c.ink : undefined} />
          </Link>
          {c.eyebrow && <p className={cn('text-sm font-medium', c.inkMuted)}>{c.eyebrow}</p>}
        </div>

        <div className="relative flex flex-col gap-6">
          <p className={cn('max-w-sm text-3xl font-bold leading-tight tracking-tight', c.ink)}>
            {c.headline}
          </p>
          <ul className="flex flex-col gap-3">
            {c.bullets.map(({ icon: Icon, label }) => (
              <li key={label} className={cn('flex items-center gap-3 text-base', c.inkMuted)}>
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className={cn('relative text-sm', c.inkMuted)}>{c.fineprint}</p>
      </aside>

      {/* Form panel */}
      <section className="flex min-h-svh flex-col items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          {/* mobile brand bar */}
          <Link href="/" aria-label="Về trang chủ BBVN" className={cn(logoLinkClass, 'md:hidden')}>
            <Logo variant="combo" />
          </Link>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
