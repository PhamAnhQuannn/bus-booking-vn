/**
 * Customer support + policy links shared by the confirmation page, ticket email and
 * PDF ticket (#843). Client-safe (no server imports) so 'use client' components can
 * deep-import it.
 *
 * Seller identity (company name + MST) is intentionally NOT here yet — owner has not
 * supplied it, and a placeholder must never reach prod. Add it here once provided.
 */

/** Shared customer support inbox (hotro@lenxevn.com). */
export const SUPPORT_EMAIL = 'hotro@lenxevn.com';

/** Cancellation & refund policy page (vi default locale, unprefixed). */
export const REFUND_POLICY_PATH = '/chinh-sach-huy-ve-hoan-tien';

/** Complaints page (vi default locale, unprefixed). */
export const COMPLAINTS_PATH = '/khieu-nai';

/**
 * Absolute public URL for a site path, built from the deploy-set NEXT_PUBLIC_BASE_URL
 * (trusted env — never Host/x-forwarded-host). Defaults to the prod origin so an
 * email/PDF link never points at localhost.
 */
export function publicSiteUrl(path = ''): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, '') || 'https://lenxevn.com';
  return `${base}${path}`;
}
