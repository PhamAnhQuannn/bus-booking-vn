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
    title: t('privacy.meta.title'),
    description: t('privacy.meta.description'),
    alternates: localeAlternates('/privacy', locale),
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });
  const b = (c: React.ReactNode) => <strong>{c}</strong>;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{t('privacy.h1')}</h1>
      <p className="text-sm text-muted-foreground">{t('privacy.updated')}</p>

      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {t('prevailingLanguage')}
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('privacy.s1.title')}</h2>
        <p className="text-sm leading-relaxed">{t('privacy.s1.body')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('privacy.s2.title')}</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('privacy.s2.items') as string[]).map((_, i) => (
            <li key={i}>{t.rich(`privacy.s2.items.${i}`, { b })}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('privacy.s3.title')}</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('privacy.s3.items') as string[]).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('privacy.s4.title')}</h2>
        <p className="text-sm leading-relaxed">{t('privacy.s4.body')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('privacy.s5.title')}</h2>
        <p className="text-sm leading-relaxed">{t('privacy.s5.intro')}</p>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('privacy.s5.items') as string[]).map((_, i) => (
            <li key={i}>{t.rich(`privacy.s5.items.${i}`, { b })}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('privacy.s6.title')}</h2>
        <p className="text-sm leading-relaxed">{t('privacy.s6.body')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('privacy.s6a.title')}</h2>
        <p className="text-sm leading-relaxed">{t('privacy.s6a.intro')}</p>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('privacy.s6a.items') as string[]).map((_, i) => (
            <li key={i}>{t.rich(`privacy.s6a.items.${i}`, { b })}</li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed">{t('privacy.s6a.note')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('privacy.s7.title')}</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('privacy.s7.items') as string[]).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('privacy.s8.title')}</h2>
        <p className="text-sm leading-relaxed">{t('privacy.s8.intro')}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {(t.raw('privacy.s8.tableHead') as string[]).map((h, i) => (
                  <th key={i} className={i === 0 ? 'py-2 pr-4 font-semibold' : 'py-2 font-semibold'}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(t.raw('privacy.s8.rows') as string[][]).map((row, i) => (
                <tr key={i}>
                  <td className="py-2 pr-4">{row[0]}</td>
                  <td className="py-2">{row[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed">
          {t.rich('privacy.s8.contact', {
            email: (c) => (
              <a href="mailto:privacy@bbvn.vn" className="text-primary underline">
                {c}
              </a>
            ),
          })}
        </p>
        <p className="text-sm leading-relaxed">{t('privacy.s8.note')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('privacy.s8a.title')}</h2>
        <p className="text-sm leading-relaxed">{t('privacy.s8a.body')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('privacy.s9.title')}</h2>
        <p className="text-sm leading-relaxed">{t('privacy.s9.body')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('privacy.s10.title')}</h2>
        <p className="text-sm leading-relaxed">
          {t.rich('privacy.s10.body', {
            email: (c) => (
              <a href="mailto:privacy@bbvn.vn" className="text-primary underline">
                {c}
              </a>
            ),
          })}
        </p>
        <p className="text-sm leading-relaxed">
          {t.rich('privacy.s10.authority', {
            link: (c) => (
              <Link href="/khieu-nai" className="text-primary underline">
                {c}
              </Link>
            ),
          })}
        </p>
      </section>

      <p className="text-xs text-muted-foreground">{t('privacy.version')}</p>

      <nav
        className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-sm"
        aria-label={t('related.aria')}
      >
        <span className="text-muted-foreground">{t('related.label')}</span>
        <Link href="/terms" className="text-primary underline">
          {t('related.terms')}
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
