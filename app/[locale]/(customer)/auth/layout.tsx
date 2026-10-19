import type { Metadata } from 'next';

/**
 * Server layout for the customer auth surface. The pages are `'use client'` and cannot
 * export metadata, so this layout applies no-index across `/auth/*` (matches robots.ts,
 * which disallows `/auth/`). Each segment's own thin layout sets the localized title.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
