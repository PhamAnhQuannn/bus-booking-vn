import type { ReactNode } from 'react';
import Link from 'next/link';
import { ShieldCheck, Bus, Wallet, BarChart3, Ticket } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

const logoLinkClass =
  'inline-flex w-fit rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * Split-panel auth shell (design: docs/design/03a-frontend-design-system/, design-language v1.0).
 *
 * Desktop (≥lg): brand panel beside the form panel. Mobile: form panel only + a slim
 * brand bar. `audience` swaps the brand panel surface + copy so customers and operators
 * land on visibly distinct doors while sharing one structural family — the customer door
 * runs a travel photo under an orange scrim; the operator door keeps a dark gradient.
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
    /** Full-bleed brand photo (customer only). null → dark gradient + route motif. */
    photo: string | null;
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
      // NOT "Hàng nghìn chuyến mỗi ngày" — at launch there are 1–2 operators, so a
      // thousands-of-trips claim is untrue (same reason PR #402 removed it from the
      // homepage). Use a claim the platform can actually back: operators are reviewed
      // + approved before their trips become bookable.
      { icon: Bus, label: 'Nhà xe được xác minh trước khi mở bán' },
      { icon: Wallet, label: 'Thanh toán an toàn, minh bạch' },
    ],
    photo: '/hero/landing-golden-md-1536.jpg',
    panel: 'bg-primary',
    ink: 'text-primary-foreground',
    inkMuted: 'text-primary-foreground/85',
    // NOT "trên toàn quốc" — no nationwide network exists at launch.
    fineprint: 'Vé xe khách liên tỉnh, đón trả tận nơi.',
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
    photo: null,
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
  eyebrow,
  title,
  subtitle,
  children,
}: {
  audience: Audience;
  /** Small tracked line above the page title (e.g. "Chào mừng trở lại"). */
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const c = CONTENT[audience];

  // AU-1: the split starts at lg, not md (below lg the form is full-width). The brand
  // side gets the larger share (1.4fr) so it earns its width, while the form side stays
  // narrow enough that a comfortably-large form column fills it instead of floating.
  return (
    <main className="grid min-h-svh lg:grid-cols-[1.4fr_1fr]">
      {/* Brand panel — desktop only */}
      <aside
        className={cn(
          'relative hidden flex-col justify-between overflow-hidden p-12 lg:flex lg:p-16',
          !c.photo && c.panel
        )}
      >
        {c.photo ? (
          <>
            {/* Full-bleed travel photo (app convention: plain <img>, not next/image). */}
            <img
              src={c.photo}
              srcSet={`/hero/landing-golden-md-1536.jpg 1536w, /hero/landing-golden-1920.jpg 1920w, /hero/landing-golden-3840.jpg 3840w`}
              sizes="58vw"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 -z-20 size-full object-cover"
            />
            {/* Directional orange scrim: stronger over the copy (left), lighter over the
                bus/landscape (right) so the photograph keeps its depth; a modest dark band
                only at the bottom keeps the fineprint + bullets ≥AA. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/85 via-primary/65 to-primary/45"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-gradient-to-t from-black/45 via-transparent to-black/10"
            />
          </>
        ) : (
          /* Operator door: decorative route motif (origin dot → path → arrowhead). */
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
        )}

        {/* Top cluster — logo + message kept together in the upper region so the brand
            and the proposition read as one thought (not spread across the whole panel). */}
        <div className="relative flex flex-col gap-14">
          <div className="flex flex-col gap-1">
            <Link href="/" aria-label="Về trang chủ BBVN" className={logoLinkClass}>
              <Logo
                variant="combo"
                mono={c.monoLogo}
                className={cn('h-16 w-auto lg:h-20', c.monoLogo ? c.ink : undefined)}
              />
            </Link>
            {c.eyebrow && <p className={cn('text-sm font-medium', c.inkMuted)}>{c.eyebrow}</p>}
          </div>

          <div className="flex flex-col gap-7">
            <p className={cn('max-w-md text-4xl font-bold leading-[1.15] tracking-tight xl:text-5xl', c.ink)}>
              {c.headline}
            </p>
            <ul className="flex flex-col gap-3.5">
              {c.bullets.map(({ icon: Icon, label }) => (
                <li key={label} className={cn('flex items-center gap-3 text-[15px]', c.inkMuted)}>
                  {/* icon full-ink (100%), label stays muted (85%) → subtle hierarchy */}
                  <Icon className={cn('size-5 shrink-0', c.ink)} aria-hidden="true" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className={cn('relative text-sm', c.inkMuted)}>{c.fineprint}</p>
      </aside>

      {/* Form panel. Asymmetric vertical padding (heavier bottom at lg) biases the form
          ~28px above dead-center so it reads as intentional, not floating mid-panel. */}
      <section className="flex min-h-svh flex-col items-center justify-center px-6 py-10 lg:pb-24">
        <div className="flex w-full max-w-[28.5rem] flex-col gap-7">
          {/* mobile brand bar (below lg, where the photo panel is hidden) */}
          <Link href="/" aria-label="Về trang chủ BBVN" className={cn(logoLinkClass, 'lg:hidden')}>
            <Logo variant="combo" className="h-14 w-auto" />
          </Link>
          <div className="flex flex-col gap-1.5">
            {eyebrow && (
              <p className="text-[13px] font-semibold tracking-wide text-primary-strong">{eyebrow}</p>
            )}
            <h1 className="text-3xl font-bold leading-tight tracking-tight">{title}</h1>
            {subtitle && <div className="text-base text-muted-foreground">{subtitle}</div>}
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
