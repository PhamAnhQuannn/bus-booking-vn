import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { localeAlternates } from '@/lib/seo';
import { ContactBookingForm } from '@/components/contact/ContactBookingForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: t('charter.title'),
    description: t('charter.description'),
    alternates: localeAlternates('/lien-he-dat-xe', locale),
  };
}

export default function ContactBookingPage() {
  const t = useTranslations('charter');
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('page.title')}</h1>
        <p className="text-base text-muted-foreground">
          {t('page.subtitle')}
        </p>
      </div>

      <ContactBookingForm />
    </main>
  );
}
