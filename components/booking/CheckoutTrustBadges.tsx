/**
 * CheckoutTrustBadges — the three reassurance badges shown under the order
 * summary on the merged checkout page (Giữ chỗ 100% / Hỗ trợ 24/7 / An toàn –
 * Uy tín). Static copy; rendered as a sibling of BookingSummaryRail so the shared
 * rail stays lean and the badges only appear at checkout.
 */

import { ShieldCheck, Headset, BadgeCheck } from 'lucide-react';

const BADGES = [
  {
    icon: ShieldCheck,
    title: 'Giữ chỗ 100%',
    detail: 'Vé của bạn được giữ đến khi thanh toán',
  },
  {
    icon: Headset,
    title: 'Hỗ trợ 24/7',
    detail: 'Tư vấn và hỗ trợ mọi lúc',
  },
  {
    icon: BadgeCheck,
    title: 'An toàn – Uy tín',
    detail: 'BBVN – Nhà xe chính hãng, phục vụ tận tâm',
  },
] as const;

export function CheckoutTrustBadges() {
  return (
    <ul className="flex flex-col gap-4">
      {BADGES.map(({ icon: Icon, title, detail }) => (
        <li key={title} className="flex items-start gap-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
