import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/** Localized document title for the client-only `/auth/forgot-password` page. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return { title: t('auth.forgotPasswordTitle') };
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
