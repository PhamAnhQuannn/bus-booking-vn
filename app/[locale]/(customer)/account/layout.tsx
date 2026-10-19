import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/**
 * Server layout for the customer-account surface. The pages themselves are
 * `'use client'` and cannot export metadata, so this server layout applies a
 * localized title and a no-index directive across the whole `/account/*`
 * subtree as defense-in-depth.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: t('account.title'),
    robots: { index: false, follow: false },
  };
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
