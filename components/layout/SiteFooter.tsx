'use client';

/**
 * Customer-facing site footer. Hidden on operator console (`/op/*`), dev
 * stub-pay (`/dev/*`), and auth pages (`/auth/*`) — same scope as SiteHeader.
 *
 * Rebuilt 2026-07-21 to the mockup's dark slab (docs/design/mockup-home.png S10):
 * brand column (logo + blurb + social chips) beside four link columns, the last of
 * which is a support-hotline block, then a bottom bar with the copyright and the
 * accepted payment methods.
 *
 * ⚠ PLACEHOLDERS in this file — the hotline number, its hours, the support email, and
 * the social links are all invented. The mockup showed "1900 1234"; that is a real,
 * billable Vietnamese service range, so a masked form is used instead. Replace or
 * remove all four before this ships.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AtSign, Mail, MessageCircle, Music2, Phone, Share2 } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import {
  PLACEHOLDER_HOTLINE,
  PLACEHOLDER_HOTLINE_HOURS,
  PLACEHOLDER_SUPPORT_EMAIL,
} from '@/components/home/homePlaceholders';

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
      { href: '/lien-he-dat-xe', label: 'Liên hệ đặt xe' },
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

/* ⚠ PLACEHOLDER — no real profiles are known. Parked on '#' rather than linked to
   pages that may not be ours. Icons are generic rather than brand marks: lucide
   dropped its brand glyphs, and a real Facebook/YouTube mark would imply an account
   that does not exist. */
const SOCIALS = [
  { icon: Share2, label: 'Facebook' },
  { icon: MessageCircle, label: 'Zalo' },
  { icon: AtSign, label: 'YouTube' },
  { icon: Music2, label: 'TikTok' },
];

/* Only the methods Phase 1 actually accepts. The mockup showed VISA / Mastercard /
   MoMo / ZaloPay — advertising schemes we do not take would fail customers at
   checkout. Rendered as monochrome wordmarks per design-research rule F4. */
const PAYMENT_METHODS = ['VietQR', 'Tiền mặt', 'VNPay'];

const linkClass =
  'inline-flex min-h-9 items-center rounded-md text-footer-muted outline-none transition-colors hover:text-footer-foreground focus-visible:ring-3 focus-visible:ring-ring/50';

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith('/op') || pathname.startsWith('/dev') || pathname.startsWith('/auth') || pathname.startsWith('/admin'))
    return null;

  const year = new Date().getFullYear();

  return (
    <footer className="bg-footer text-footer-foreground">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 py-12 text-sm sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr] lg:gap-10">
        {/* Brand column */}
        <div className="flex flex-col gap-3">
          <Logo variant="combo" className="h-12 w-auto" />
          <p className="max-w-xs text-footer-muted">
            BBVN – Nền tảng đặt vé xe khách trực tuyến. Đặt vé nhanh chóng, giá tốt, hỗ trợ
            tận tình.
          </p>
          <ul className="mt-2 flex list-none gap-2 p-0">
            {SOCIALS.map(({ icon: Icon, label }) => (
              <li key={label}>
                <a
                  href="#"
                  aria-label={label}
                  className="inline-flex size-9 items-center justify-center rounded-full bg-footer-chip text-footer-foreground outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Icon className="size-4" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
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

        {/* Hotline column — ⚠ placeholder contact details, see file header. */}
        <div className="flex flex-col gap-3">
          <span className="font-semibold text-footer-foreground">Tổng đài hỗ trợ</span>
          <span className="flex items-center gap-2 text-xl font-bold text-primary">
            <Phone className="size-5 shrink-0" aria-hidden="true" />
            {PLACEHOLDER_HOTLINE}
          </span>
          <span className="text-footer-muted">{PLACEHOLDER_HOTLINE_HOURS}</span>
          <span className="flex items-center gap-2 text-primary">
            <Mail className="size-4 shrink-0" aria-hidden="true" />
            {PLACEHOLDER_SUPPORT_EMAIL}
          </span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4">
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
