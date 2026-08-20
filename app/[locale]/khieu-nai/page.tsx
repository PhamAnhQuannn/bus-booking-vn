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
    title: t('complaints.meta.title'),
    description: t('complaints.meta.description'),
    alternates: localeAlternates('/khieu-nai'),
  };
}

export default async function ComplaintPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });
  const b = (c: React.ReactNode) => <strong>{c}</strong>;
  const email = (c: React.ReactNode) => (
    <a href="mailto:support@bbvn.vn" className="text-primary underline">
      {c}
    </a>
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{t('complaints.h1')}</h1>
      <p className="text-sm text-muted-foreground">{t('complaints.updated')}</p>

      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {t('prevailingLanguage')}
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('complaints.s1.title')}</h2>
        <p className="text-sm leading-relaxed">{t('complaints.s1.body')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('complaints.s2.title')}</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('complaints.s2.items') as string[]).map((_, i) => (
            <li key={i}>{t.rich(`complaints.s2.items.${i}`, { b, email })}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('complaints.s3.title')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {(t.raw('complaints.s3.tableHead') as string[]).map((h, i) => (
                  <th key={i} className={i < 2 ? 'py-2 pr-4 font-semibold' : 'py-2 font-semibold'}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(t.raw('complaints.s3.rows') as string[][]).map((row, i) => (
                <tr key={i}>
                  <td className="py-2 pr-4">{row[0]}</td>
                  <td className="py-2 pr-4">{row[1]}</td>
                  <td className="py-2">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed">{t('complaints.s3.note')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('complaints.s4.title')}</h2>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('complaints.s4.items') as string[]).map((_, i) => (
            <li key={i}>
              {t.rich(`complaints.s4.items.${i}`, {
                b,
                link: (c) => (
                  <Link href="/chinh-sach-huy-ve-hoan-tien" className="text-primary underline">
                    {c}
                  </Link>
                ),
              })}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('complaints.s5.title')}</h2>
        <p className="text-sm leading-relaxed">{t('complaints.s5.body')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('complaints.s6.title')}</h2>
        <p className="text-sm leading-relaxed">{t('complaints.s6.intro')}</p>
        <ul className="list-disc pl-6 text-sm leading-relaxed">
          {(t.raw('complaints.s6.items') as string[]).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('complaints.s7.title')}</h2>
        <p className="text-sm leading-relaxed">
          {t.rich('complaints.s7.body', {
            link: (c) => (
              <Link href="/privacy" className="text-primary underline">
                {c}
              </Link>
            ),
          })}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('complaints.s8.title')}</h2>
        <p className="text-sm leading-relaxed">{t.rich('complaints.s8.body', { email })}</p>
      </section>

      <p className="text-xs text-muted-foreground">{t('complaints.version')}</p>

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
        <Link href="/chinh-sach-huy-ve-hoan-tien" className="text-primary underline">
          {t('related.refund')}
        </Link>
      </nav>
    </main>
  );
}
