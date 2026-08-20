import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

/**
 * Locale layout (P-spike). Provides the next-intl client context for everything under
 * `app/[locale]`. It does NOT render <html>/<body> — the root layout (app/layout.tsx)
 * still owns those during the spike, so `<html lang>` stays "vi" even on /en/… for now.
 * P0 moves the root <html lang> binding here (or into a route-group root) so the lang
 * attribute tracks the locale.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
