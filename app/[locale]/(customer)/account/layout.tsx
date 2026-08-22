import type { Metadata } from 'next';

/**
 * Server layout for the customer-account surface. The pages themselves are
 * `'use client'` and cannot export metadata, so this server layout applies a
 * no-index directive across the whole `/account/*` subtree as defense-in-depth.
 */
export const metadata: Metadata = {
  title: 'Tài khoản | BBVN',
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
