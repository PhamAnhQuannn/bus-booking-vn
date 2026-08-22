import { getTranslations } from 'next-intl/server';
import { ShieldCheck, Phone, CreditCard, FileText, Headset } from 'lucide-react';
import { Link } from '@/i18n/navigation';

// Real support hotline from NEXT_PUBLIC_SUPPORT_PHONE (Vercel-set), same source as
// SiteFooter / AuthSplitLayout. Never a hardcoded placeholder — omitted when unset.
const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim();

/**
 * Trust/context panel shown in the results view when there is a single operator
 * (the filter rail is absent). Fills the space the rail would occupy so the page
 * never looks half-empty — using ONLY real fields (operator name + phone, already
 * fetched) and real static policy content. No invented ratings/stops/amenities.
 */
export async function OperatorTrustPanel({
  operatorLegalName,
  operatorContactPhone,
}: {
  operatorLegalName: string;
  operatorContactPhone: string;
}) {
  const t = await getTranslations('search');
  return (
    <aside aria-label={t('trust.aria')}>
      {/* Offsets track SiteHeader height (parity with SearchFilterRail). */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-e1 md:sticky md:top-20 lg:top-[104px]">
        <div className="flex flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="size-3.5" aria-hidden="true" /> {t('trust.approved')}
          </span>
          <p className="text-sm font-semibold text-foreground">{operatorLegalName}</p>
          <a
            href={`tel:${operatorContactPhone}`}
            className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <Phone className="size-4" aria-hidden="true" /> {operatorContactPhone}
          </a>
        </div>

        <div className="border-t border-border/60 pt-3">
          <h2 className="mb-2 text-sm font-semibold text-foreground">{t('trust.title')}</h2>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {t('trust.point1')}
            </li>
            <li className="flex items-start gap-2">
              <CreditCard className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {t('trust.point2')}
            </li>
            <li className="flex items-start gap-2">
              <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <Link href="/chinh-sach-huy-ve-hoan-tien" className="underline-offset-4 hover:text-foreground hover:underline">
                {t('trust.refundLink')}
              </Link>
            </li>
            {SUPPORT_PHONE ? (
              <li className="flex items-start gap-2">
                <Headset className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  {t('trust.supportLabel')}
                  <a href={`tel:${SUPPORT_PHONE}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {SUPPORT_PHONE}
                  </a>
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </aside>
  );
}
