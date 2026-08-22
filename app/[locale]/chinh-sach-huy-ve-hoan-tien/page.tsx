import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { localeAlternates } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });
  return {
    title: t('refund.meta.title'),
    description: t('refund.meta.description'),
    alternates: localeAlternates('/chinh-sach-huy-ve-hoan-tien', locale),
  };
}

export default async function CancellationRefundPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });
  const termsLink = (c: React.ReactNode) => (
    <Link href="/terms" className="text-primary underline">
      {c}
    </Link>
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{t('refund.h1')}</h1>
      <p className="text-sm text-muted-foreground">{t('refund.updated')}</p>

      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {t('prevailingLanguage')}
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('refund.s1.title')}</h2>
        <p className="text-sm leading-relaxed">{t.rich('refund.s1.body', { link: termsLink })}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('refund.s2.title')}</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('refund.s2.items') as string[]).map((_, i) => (
            <li key={i}>
              {t.rich(`refund.s2.items.${i}`, {
                charter: (c) => (
                  <Link href="/lien-he-dat-xe" className="text-primary underline">
                    {c}
                  </Link>
                ),
              })}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('refund.s3.title')}</h2>
        <p className="text-sm leading-relaxed">
          {t.rich('refund.s3.body', { b: (c) => <strong>{c}</strong> })}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('refund.s4.title')}</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('refund.s4.items') as string[]).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('refund.s5.title')}</h2>
        <p className="text-sm leading-relaxed">{t('refund.s5.intro')}</p>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('refund.s5.items') as string[]).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('refund.s6.title')}</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('refund.s6.items') as string[]).map((_, i) => (
            <li key={i}>
              {t.rich(`refund.s6.items.${i}`, {
                email: (c) => (
                  <a href="mailto:support@bbvn.vn" className="text-primary underline">
                    {c}
                  </a>
                ),
              })}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('refund.s7.title')}</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('refund.s7.items') as string[]).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('refund.s8.title')}</h2>
        <p className="text-sm leading-relaxed">{t('refund.s8.body')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('refund.s9.title')}</h2>
        <p className="text-sm leading-relaxed">
          {t.rich('refund.s9.body', {
            link: (c) => (
              <Link href="/khieu-nai" className="text-primary underline">
                {c}
              </Link>
            ),
            email: (c) => (
              <a href="mailto:support@bbvn.vn" className="text-primary underline">
                {c}
              </a>
            ),
          })}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('refund.s10.title')}</h2>
        <p className="text-sm leading-relaxed">{t.rich('refund.s10.body', { link: termsLink })}</p>
      </section>

      <p className="text-xs text-muted-foreground">{t('refund.version')}</p>

      <nav
        className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-sm"
        aria-label={t('related.aria')}
      >
        <span className="text-muted-foreground">{t('related.label')}</span>
        <Link href="/terms" className="text-primary underline">
          {t('related.terms')}
        </Link>
        <Link href="/privacy" className="text-primary underline">
          {t('related.privacy')}
        </Link>
        <Link href="/khieu-nai" className="text-primary underline">
          {t('related.complaints')}
        </Link>
      </nav>
    </main>
  );
}
