/**
 * CheckoutTrustBadges — the three reassurance badges shown under the order
 * summary on the merged checkout page (Giữ chỗ 100% / Hỗ trợ 24/7 / An toàn –
 * Uy tín). Static copy; rendered as a sibling of BookingSummaryRail so the shared
 * rail stays lean and the badges only appear at checkout.
 */

import { useTranslations } from 'next-intl';
import { ShieldCheck, Headset, BadgeCheck } from 'lucide-react';

const BADGES = [
  { icon: ShieldCheck, titleKey: 'badges.badge1Title', detailKey: 'badges.badge1Detail' },
  { icon: Headset, titleKey: 'badges.badge2Title', detailKey: 'badges.badge2Detail' },
  { icon: BadgeCheck, titleKey: 'badges.badge3Title', detailKey: 'badges.badge3Detail' },
] as const;

export function CheckoutTrustBadges() {
  const t = useTranslations('booking');
  return (
    <ul className="flex flex-col gap-4">
      {BADGES.map(({ icon: Icon, titleKey, detailKey }) => (
        <li key={titleKey} className="flex items-start gap-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t(titleKey)}</p>
            <p className="text-xs text-muted-foreground">{t(detailKey)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
