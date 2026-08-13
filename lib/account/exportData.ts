/**
 * #471 (PDPL data-subject access) — assemble the personal data held for one customer.
 *
 * Complements the existing delete endpoint (right-to-erasure) with the right-to-access. Returns
 * the requester's OWN data only (the route scopes customerId to the authenticated caller). No
 * secrets are included: passwordHash, refreshTokenHash, tokenFamily, confirmationToken and
 * internal ops notes are deliberately omitted — only fields the data subject is entitled to.
 */

import { prisma } from '@/lib/core/db/client';

export async function exportCustomerData(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      email: true,
      phone: true,
      displayName: true,
      createdAt: true,
      lastLoginAt: true,
      emailVerifiedAt: true,
      suspendedAt: true,
      deletedAt: true,
      // Linked OAuth providers — provider + linked email only (not the pseudonymous sub).
      accounts: {
        select: { provider: true, email: true, createdAt: true },
      },
      // Signup ToS/privacy consent history (#472).
      customerConsents: {
        select: { consentType: true, version: true, consentedAt: true },
        orderBy: { consentedAt: 'desc' },
      },
      // Login history / active devices (#477) — metadata only, never the token hash/family.
      sessions: {
        select: { createdAt: true, expiresAt: true, revokedAt: true, ip: true, userAgent: true },
        orderBy: { createdAt: 'desc' },
      },
      // The customer's bookings — their own contact snapshot + trip/payment facts.
      bookings: {
        select: {
          bookingRef: true,
          status: true,
          buyerName: true,
          buyerPhone: true,
          buyerEmail: true,
          ticketCount: true,
          totalVnd: true,
          paymentMethod: true,
          createdAt: true,
          paidAt: true,
          pickupKind: true,
          pickupDetail: true,
          boardingPoint: true,
          boardingTime: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return customer;
}
