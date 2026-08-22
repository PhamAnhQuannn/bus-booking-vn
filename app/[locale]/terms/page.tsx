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
    title: t('terms.meta.title'),
    description: t('terms.meta.description'),
    alternates: localeAlternates('/terms', locale),
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{t('terms.h1')}</h1>
      <p className="text-sm text-muted-foreground">{t('terms.updated')}</p>

      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {t('prevailingLanguage')}
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('terms.s1.title')}</h2>
        <p className="text-sm leading-relaxed">{t('terms.s1.body')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('terms.s2.title')}</h2>
        <p className="text-sm leading-relaxed">{t('terms.s2.intro')}</p>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('terms.s2.items') as string[]).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed">{t('terms.s2.note')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('terms.s3.title')}</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('terms.s3.items') as string[]).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('terms.s4.title')}</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('terms.s4.items') as string[]).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('terms.s5.title')}</h2>
        <p className="text-sm leading-relaxed">
          {t.rich('terms.s5.body', {
            link: (c) => (
              <Link href="/chinh-sach-huy-ve-hoan-tien" className="text-primary underline">
                {c}
              </Link>
            ),
          })}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('terms.s6.title')}</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('terms.s6.items') as string[]).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('terms.s7.title')}</h2>
        <p className="text-sm leading-relaxed">{t('terms.s7.body')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('terms.s8.title')}</h2>
        <p className="text-sm leading-relaxed">{t('terms.s8.body')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('terms.s9.title')}</h2>
        <p className="text-sm leading-relaxed">{t('terms.s9.body')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('terms.s10.title')}</h2>
        <p className="text-sm leading-relaxed">{t('terms.s10.body')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('terms.s11.title')}</h2>
        <p className="text-sm leading-relaxed">
          {t.rich('terms.s11.body', {
            email: (c) => (
              <a href="mailto:support@bbvn.vn" className="text-primary underline">
                {c}
              </a>
            ),
            link: (c) => (
              <Link href="/khieu-nai" className="text-primary underline">
                {c}
              </Link>
            ),
          })}
        </p>
      </section>

      <p className="text-xs text-muted-foreground">{t('terms.version')}</p>

      <nav
        className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-sm"
        aria-label={t('related.aria')}
      >
        <span className="text-muted-foreground">{t('related.label')}</span>
        <Link href="/privacy" className="text-primary underline">
          {t('related.privacy')}
        </Link>
        <Link href="/chinh-sach-huy-ve-hoan-tien" className="text-primary underline">
          {t('related.refund')}
        </Link>
        <Link href="/khieu-nai" className="text-primary underline">
          {t('related.complaints')}
        </Link>
      </nav>
    </main>
  );
}
