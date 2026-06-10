import type { Metadata } from 'next';

/**
 * Server layout for the parked customer-account surface (guest-only since
 * 2026-06-06; proxy.ts redirects these pages to `/`). The pages themselves are
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
