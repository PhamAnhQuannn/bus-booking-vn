import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, Bus, Wallet, BarChart3, Ticket } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

const logoLinkClass =
  'inline-flex w-fit rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * Split-panel auth shell (design: docs/design/03a-frontend-design-system/, design-language v1.0).
 *
 * Desktop (≥lg): brand panel beside the form panel. Mobile: form panel only + a slim
 * brand bar. `audience` swaps the ENTIRE brand panel so customers and operators land on
 * visibly distinct doors while sharing one structural family:
 *   - customer: golden-hour travel photo under a directional orange scrim (emotional).
 *   - operator: dusk bus-depot photo under a dark scrim + a diagonal orange "blade" seam,
 *     icon-chip benefit rows and a trust badge (a restrained back-office ops portal).
 *
 * The two panels are rendered by separate branches (see `audience === 'operator'`) so a
 * change to one door cannot regress the other. No client hooks — safe to compose inside
 * the 'use client' auth pages.
 */

type Audience = 'customer' | 'operator';

// Real support line comes from NEXT_PUBLIC_SUPPORT_PHONE (Vercel-set), never a source
// literal — same rule + formatter as SiteFooter (a fabricated "1900 xxxx" was shipped
// and ripped out once; CI gate G7 guards it). Unset → the row is hidden.
const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim();
const SUPPORT_PHONE_DISPLAY =
  SUPPORT_PHONE && /^\d{10}$/.test(SUPPORT_PHONE)
    ? `${SUPPORT_PHONE.slice(0, 4)} ${SUPPORT_PHONE.slice(4, 7)} ${SUPPORT_PHONE.slice(7)}`
    : SUPPORT_PHONE;

type Bullet = { icon: typeof Bus; label: string; sub?: string };

type PanelContent = {
  eyebrow: string | null;
  headline: string;
  headlineAccent?: string;
  subhead?: string[];
  bullets: Bullet[];
  badge?: { icon: typeof Bus; title: string; sub: string };
  photo: string;
  photo2x: string;
  base: string;
  ink: string;
  inkMuted: string;
  fineprint?: string;
  monoLogo: boolean;
};

// Customer brand-panel copy is localized (auth.brand.*). The operator panel stays
// Vietnamese for now — the operator console + its auth surface are P5 (#638).
function getContent(t: ReturnType<typeof useTranslations>): Record<Audience, PanelContent> {
  return {
    customer: {
      eyebrow: null,
      headline: t('brand.customerHeadline'),
      bullets: [
        { icon: ShieldCheck, label: t('brand.customerBullet1') },
        // NOT "thousands of trips a day" — at launch there are 1–2 operators; use a claim
        // the platform can back: operators are reviewed + approved before selling.
        { icon: Bus, label: t('brand.customerBullet2') },
        { icon: Wallet, label: t('brand.customerBullet3') },
      ],
      photo: '/hero/landing-golden-md-1536.jpg',
      photo2x: '/hero/landing-golden-md-1536@2x.webp',
      base: 'bg-primary',
      ink: 'text-primary-foreground',
      inkMuted: 'text-primary-foreground/85',
      fineprint: t('brand.customerFineprint'),
      monoLogo: true,
    },
    operator: {
      eyebrow: 'Cổng nhà xe',
      headline: 'Cổng quản trị',
      headlineAccent: 'nhà xe',
      subhead: [
        'Giải pháp quản lý toàn diện cho đối tác vận tải.',
        'Vận hành hiệu quả – Doanh thu bứt phá.',
      ],
      bullets: [
        { icon: Bus, label: 'Quản lý lịch chạy & đội xe', sub: 'Theo dõi lịch trình, phương tiện và tài xế.' },
        { icon: BarChart3, label: 'Theo dõi doanh thu', sub: 'Báo cáo chi tiết, cập nhật theo thời gian thực.' },
        { icon: Ticket, label: 'Xử lý đặt vé của khách', sub: 'Tiếp nhận, xác nhận và chăm sóc khách hàng.' },
      ],
      badge: {
        icon: ShieldCheck,
        title: 'Nền tảng vận hành tin cậy',
        sub: 'Bảo mật cao – Ổn định – Hỗ trợ tận tâm',
      },
      photo: '/hero/operator-depot.jpg',
      photo2x: '/hero/operator-depot@2x.webp',
      base: 'bg-[#111318]',
      ink: 'text-white',
      inkMuted: 'text-white/70',
      monoLogo: true,
    },
  };
}

// Operator diagonal seam: the dark panel is wider at the bottom than the top (leans `\`).
// OUTER is the orange "blade" base; INNER (photo) is inset ~5px along the diagonal so a
// thin orange sliver shows on the seam. The top-right triangle the OUTER clips away reveals
// the warm page background (`main` is bg-background) so it blends into the form panel.
const OP_CLIP_OUTER = 'polygon(0 0, 90% 0, 100% 100%, 0 100%)';
const OP_CLIP_INNER = 'polygon(0 0, calc(90% - 5px) 0, calc(100% - 5px) 100%, 0 100%)';

function imageSet(jpg: string, webp: string) {
  return `image-set(url('${jpg}') 1x, url('${webp}') 2x)`;
}

export function AuthSplitLayout({
  audience,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  audience: Audience;
  /** Small tracked line above the page title (e.g. "Chào mừng trở lại"). ReactNode so
      a page can prefix an icon (login passes a ShieldCheck + text). */
  eyebrow?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations('auth');
  const c = getContent(t)[audience];
  const isOperator = audience === 'operator';

  return (
    <main
      className={cn(
        'grid min-h-svh bg-background',
        // Operator door prioritises utility → a near-even split (~52/48). Customer door
        // earns a stronger visual hero (1.4fr). The diagonal makes the operator dark
        // region read narrower at the top than its 52% column, which is intentional.
        isOperator ? 'lg:grid-cols-[1.08fr_1fr]' : 'lg:grid-cols-[1.4fr_1fr]'
      )}
    >
      {isOperator ? (
        /* ───────────── Operator brand panel ───────────── */
        <aside
          className="relative isolate hidden flex-col justify-between overflow-hidden bg-primary p-12 lg:flex lg:p-16"
          style={{ clipPath: OP_CLIP_OUTER }}
        >
          {/* Depot photo + dark scrim, inset along the diagonal to leave the orange blade.
              CSS background-image (not <img>): a display:none subtree below lg fetches 0
              bytes. bg-[#111318] is the opaque fallback if the image fails. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[#111318] bg-cover bg-center"
            style={{ clipPath: OP_CLIP_INNER, backgroundImage: imageSet(c.photo, c.photo2x) }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/60 to-black/25" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            {/* warm glow echoing the canopy "BBVN" sign in the photo */}
            <div className="absolute right-6 bottom-24 size-72 rounded-full bg-primary/25 blur-3xl" />
          </div>

          {/* Top cluster — logo row + proposition kept together in the upper region. */}
          <div className="relative flex flex-col gap-12">
            <div className="flex items-center gap-4">
              <Link href="/" aria-label={t('common.backToHome')} className={logoLinkClass}>
                <Logo variant="combo" mono className={cn('h-14 w-auto', c.ink)} />
              </Link>
              {c.eyebrow && (
                <>
                  <span aria-hidden="true" className="h-9 w-px bg-white/20" />
                  <span className={cn('text-[15px]', c.inkMuted)}>{c.eyebrow}</span>
                </>
              )}
            </div>

            <div className="flex flex-col gap-6">
              <p className={cn('text-4xl font-extrabold leading-[1.1] tracking-tight xl:text-5xl', c.ink)}>
                {c.headline}
                {c.headlineAccent && (
                  <>
                    <br />
                    <span className="text-primary">{c.headlineAccent}</span>
                  </>
                )}
              </p>
              {c.subhead && (
                <div className={cn('max-w-md space-y-0.5 text-[17px]', c.inkMuted)}>
                  {c.subhead.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              )}
              <ul className="mt-2 flex flex-col gap-4">
                {c.bullets.map(({ icon: Icon, label, sub }) => (
                  <li key={label} className="flex items-start gap-3.5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                      <Icon className={cn('size-5', c.ink)} aria-hidden="true" />
                    </span>
                    <div className="flex flex-col gap-0.5 pt-0.5">
                      <span className={cn('text-[15px] font-semibold', c.ink)}>{label}</span>
                      {sub && <span className={cn('text-[13px]', c.inkMuted)}>{sub}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Trust badge — content-width glass card at the panel foot. */}
          {c.badge && (
            <div className="relative flex w-fit max-w-sm items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
                <c.badge.icon className={cn('size-5', c.ink)} aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <span className={cn('text-[15px] font-semibold', c.ink)}>{c.badge.title}</span>
                <span className={cn('text-[13px]', c.inkMuted)}>{c.badge.sub}</span>
              </div>
            </div>
          )}
        </aside>
      ) : (
        /* ───────────── Customer brand panel (unchanged) ───────────── */
        <aside
          className={cn(
            'relative isolate hidden flex-col justify-between overflow-hidden p-12 lg:flex lg:p-16',
            c.base
          )}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-20 bg-cover bg-center"
            style={{ backgroundImage: imageSet(c.photo, c.photo2x) }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/85 via-primary/70 to-primary/50"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-r from-black/55 via-black/25 to-transparent"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-t from-black/40 to-transparent"
          />

          <div className="relative flex flex-col gap-14">
            <div className="flex flex-col gap-1">
              <Link href="/" aria-label={t('common.backToHome')} className={logoLinkClass}>
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
                    <Icon className={cn('size-5 shrink-0', c.ink)} aria-hidden="true" />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={cn('relative flex items-start gap-2.5 text-sm', c.inkMuted)}>
          <ShieldCheck className={cn('mt-0.5 size-4 shrink-0', c.ink)} aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <span>{c.fineprint}</span>
            {SUPPORT_PHONE_DISPLAY && <span>{t('brand.support', { phone: SUPPORT_PHONE_DISPLAY })}</span>}
          </div>
        </div>
        </aside>
      )}

      {/* Form panel. Asymmetric vertical padding (heavier bottom at lg) biases the form
          ~28px above dead-center so it reads as intentional, not floating mid-panel. */}
      <section className="flex min-h-svh flex-col items-center justify-center px-6 py-10 lg:pb-24">
        <div className="flex w-full max-w-[28.5rem] flex-col gap-7">
          {/* mobile brand bar (below lg, where the photo panel is hidden) */}
          <Link href="/" aria-label={t('common.backToHome')} className={cn(logoLinkClass, 'lg:hidden')}>
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
