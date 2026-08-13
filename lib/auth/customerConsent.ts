/**
 * #472 (DS-003 / PDPL) — customer signup consent capture.
 *
 * At registration the customer accepts the Terms of Service + Privacy Policy. We persist one
 * append-only CustomerConsent row per consent type (versioned) as lawful-basis evidence —
 * distinct from the booking-scoped ConsentRecord (lib/booking/consent.ts), which is bound to
 * a bookingId. A version bump writes fresh rows; history is retained (no updates/deletes).
 */

import type { Prisma } from '@prisma/client';

/** Current signup consent text version. Bump when the ToS / Privacy copy changes. */
export const CUSTOMER_CONSENT_VERSION = '2026-08';

/** Documented CustomerConsent.consentType union. */
export const CUSTOMER_CONSENT_TYPES = {
  tos: 'tos',
  privacy: 'privacy',
} as const;

export type CustomerConsentType =
  (typeof CUSTOMER_CONSENT_TYPES)[keyof typeof CUSTOMER_CONSENT_TYPES];

/**
 * Write the ToS + Privacy consent rows for a newly-registered customer. Runs inside the
 * register() transaction so consent and the Customer row commit atomically — a customer
 * never exists without its signup consent evidence.
 */
export async function recordRegistrationConsent(
  tx: Prisma.TransactionClient,
  customerId: string,
): Promise<void> {
  await tx.customerConsent.createMany({
    data: [
      { customerId, consentType: CUSTOMER_CONSENT_TYPES.tos, version: CUSTOMER_CONSENT_VERSION },
      { customerId, consentType: CUSTOMER_CONSENT_TYPES.privacy, version: CUSTOMER_CONSENT_VERSION },
    ],
  });
}
