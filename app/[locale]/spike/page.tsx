import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

/**
 * Throwaway i18n proof route (P-spike). Delete before P0 lands its real tree.
 * Reachable at `/spike` (vi, unprefixed) and `/en/spike` (en). Proves: server-side
 * translation (getTranslations), locale routing, and the switcher preserving the path.
 */
export default async function SpikePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('spike');
  const c = await getTranslations('common');

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <LanguageSwitcher />
      </div>
      <p className="text-muted-foreground">{t('intro')}</p>
      <dl className="rounded-xl border border-border bg-card p-4 text-sm">
        <div className="flex justify-between py-1">
          <dt className="text-muted-foreground">{t('currentLocale')}</dt>
          <dd className="font-mono font-semibold">{locale}</dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-muted-foreground">common.bookTicket</dt>
          <dd className="font-medium">{c('bookTicket')}</dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-muted-foreground">common.search</dt>
          <dd className="font-medium">{c('search')}</dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-muted-foreground">common.login</dt>
          <dd className="font-medium">{c('login')}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">{t('note')}</p>
    </main>
  );
}
