'use client';

/**
 * Customer-facing site footer. Hidden on operator console (`/op/*`), dev
 * stub-pay (`/dev/*`), and auth pages (`/auth/*`) — same scope as SiteHeader.
 *
 * Rebuilt 2026-07-21 to the mockup's dark slab (docs/design/mockup-home.png S10):
 * brand column beside four link columns, the last a support block, then a bottom
 * bar with the copyright and the accepted payment methods.
 *
 * 2026-07-30: this header used to warn that the hotline, its hours, the support
 * email AND the social links were "all invented … replace or remove all four
 * before this ships". It shipped anyway, and the warning was wrong on one count:
 * hotro@lenxevn.com is genuine and monitored (lib/notification/esms.ts). The three
 * that really were invented — the 1900 xxxx hotline, its opening hours, and four
 * social chips all pointing at "#" — are now gone. Nothing in this file is a
 * placeholder; if that changes, scripts/audit/greppable-invariants.sh G7 fails CI
 * rather than relying on anyone reading this paragraph.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mail, Phone } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

/**
 * Real, monitored support address. 2026-07-30: this used to sit in
 * components/home/homePlaceholders.ts alongside a fabricated `1900 xxxx` hotline and
 * its opening hours. That file is deleted; the one genuine value moved here, to the
 * only component that renders it.
 */
const SUPPORT_EMAIL = 'hotro@lenxevn.com';

/**
 * Real support hotline comes from NEXT_PUBLIC_SUPPORT_PHONE (set in Vercel), NOT a
 * source literal: a real VN mobile is PII and the pre-commit secret scan normalises
 * 0… → +84… and blocks it. The env value is baked into the client bundle at build (the
 * number is public on the page anyway) but never lands in git. Unset (local/dev) → the
 * phone row is simply hidden.
 */
const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim();
// Group a 10-digit VN mobile as "0976 167 267"; show as-is otherwise.
const SUPPORT_PHONE_DISPLAY =
  SUPPORT_PHONE && /^\d{10}$/.test(SUPPORT_PHONE)
    ? `${SUPPORT_PHONE.slice(0, 4)} ${SUPPORT_PHONE.slice(4, 7)} ${SUPPORT_PHONE.slice(7)}`
    : SUPPORT_PHONE;

// 2026-06-06: customer accounts paused (guest-only). "Tài khoản" removed; "Đăng nhập"
// now points at the operator login (/op/login) — only operators log in. "Trở thành
// đối tác" routes operators to the application form.
// 2026-07-16: operator login/register moved out of the "ĐẶT VÉ" customer group into
// its own "Dành cho nhà xe" partner group — the customer-facing group's strongest
// slot should not carry a B2B utility link (audit F9).
const FOOTER_COLUMNS = [
  {
    heading: 'Về BBVN',
    links: [
      { href: '/tro-ly-du-lich', label: 'Trợ lý du lịch' },
      { href: '/terms', label: 'Điều khoản dịch vụ' },
      { href: '/privacy', label: 'Chính sách bảo mật' },
    ],
  },
  {
    heading: 'Hỗ trợ',
    links: [
      { href: '/chinh-sach-huy-ve-hoan-tien', label: 'Chính sách hủy/hoàn vé' },
      { href: '/khieu-nai', label: 'Giải quyết khiếu nại' },
    ],
  },
  {
    heading: 'Hợp tác',
    links: [
      { href: '/op/register', label: 'Trở thành đối tác' },
      { href: '/op/login', label: 'Đăng nhập nhà xe' },
    ],
  },
] as const;

/* 2026-07-30: four social chips (Facebook / Zalo / YouTube / TikTok) rendered here,
   every one of them href="#". No such profiles exist, so the icons advertised
   channels a customer could not reach. Gone until real accounts exist. */

/* Only the methods Phase 1 actually accepts. The mockup showed VISA / Mastercard /
   MoMo / ZaloPay — advertising schemes we do not take would fail customers at
   checkout. Rendered as monochrome wordmarks per design-research rule F4. */
const PAYMENT_METHODS = ['VietQR', 'VNPay'];

const linkClass =
  'inline-flex min-h-9 items-center rounded-md text-footer-muted outline-none transition-colors hover:text-footer-foreground focus-visible:ring-3 focus-visible:ring-ring/50';

export function SiteFooter() {
  const pathname = usePathname();
  // /tro-ly-du-lich chiếm trọn viewport (chat+map, cuộn nội bộ) → không footer (P1-3, chống double-scroll).
  if (pathname.startsWith('/op') || pathname.startsWith('/dev') || pathname.startsWith('/auth') || pathname.startsWith('/admin') || pathname.startsWith('/tro-ly-du-lich'))
    return null;

  const year = new Date().getFullYear();

  return (
    <footer className="bg-footer text-footer-foreground">
      <div className="page-container grid grid-cols-1 gap-8 py-12 text-sm sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr] lg:gap-10">
        {/* Brand column */}
        <div className="flex flex-col gap-3">
          {/* mono: the footer slab is `--footer` (~#202123) and the colour
              lockup's wordmark is near-black ink, which all but disappears on
              it. The white knockout is what public/brand/README.md assigns to
              dark surfaces. */}
          <Logo variant="combo" mono className="h-12 w-auto" />
          <p className="max-w-xs text-footer-muted">
            BBVN – Nền tảng đặt vé xe khách trực tuyến. Đặt vé nhanh chóng, giá tốt, hỗ trợ
            tận tình.
          </p>
        </div>

        {FOOTER_COLUMNS.map((col) => (
          <nav key={col.heading} className="flex flex-col gap-3" aria-label={col.heading}>
            <span className="font-semibold text-footer-foreground">{col.heading}</span>
            <div className="flex flex-col gap-1">
              {col.links.map((l) => (
                <Link key={l.href} href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              ))}
            </div>
          </nav>
        ))}

        {/* 2026-07-30: this column led with a masked premium-rate support number and
            invented opening hours. The mask was rendered literally, so a customer on
            the live site saw an unfinished placeholder where the support line should
            be — and that number range is real and billable, which we hold no number
            in. Both removed; the email below is genuine and monitored.
            (Deliberately not quoting the old literal here: greppable-invariants G7
            fails on it, which is the point.) */}
        <div className="flex flex-col gap-3">
          <span className="font-semibold text-footer-foreground">Hỗ trợ khách hàng</span>
          {SUPPORT_PHONE && (
            <a
              href={`tel:${SUPPORT_PHONE}`}
              className="flex items-center gap-2 text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Phone className="size-4 shrink-0" aria-hidden="true" />
              {SUPPORT_PHONE_DISPLAY}
            </a>
          )}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-2 text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Mail className="size-4 shrink-0" aria-hidden="true" />
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>

      <div className="page-container">
        <div className="flex flex-col items-center justify-between gap-4 border-t border-footer-hairline py-5 text-xs text-footer-muted sm:flex-row">
          <span>© {year} BBVN. All rights reserved.</span>
          <ul className="flex list-none items-center gap-4 p-0">
            {PAYMENT_METHODS.map((m) => (
              <li key={m} className="font-semibold uppercase tracking-wide">
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
