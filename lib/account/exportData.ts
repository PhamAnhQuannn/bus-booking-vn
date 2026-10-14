/**
 * #471 (PDPL data-subject access) — assemble the personal data held for one customer.
 *
 * Complements the existing delete endpoint (right-to-erasure) with the right-to-access. Returns
 * the requester's OWN data only (the route scopes customerId to the authenticated caller). No
 * secrets are included: passwordHash, refreshTokenHash, tokenFamily, confirmationToken and
 * internal ops notes are deliberately omitted — only fields the data subject is entitled to.
 *
 * #842: also covers planner conversations, charter requests, notification-log rows and
 * booking-level consent records. Every nested relation is reached through this customer's
 * own rows (customerId / their bookings), so no other user's data can be selected.
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
          // #842: checkout consents captured for this booking (Issue 089).
          consents: {
            select: { consentType: true, version: true, consentedAt: true },
            orderBy: { consentedAt: 'desc' },
          },
          // #842: SMS/email sent about this booking. Delivery-retry internals
          // (attemptCount/keySalt/nextAttemptAt/lastError/externalRef) are ops-only.
          notifications: {
            select: {
              channel: true,
              template: true,
              recipient: true,
              payload: true,
              status: true,
              sentAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      // #842: charter requests the customer submitted while signed in (customerId-linked).
      // Guest charter leads are not matched by email/phone — an unverified contact field is
      // not proof of identity. Operator assignment / admin rejection notes are internal.
      charterRequests: {
        select: {
          ref: true,
          status: true,
          contactName: true,
          contactPhone: true,
          contactEmail: true,
          destinations: true,
          startDate: true,
          endDate: true,
          durationDays: true,
          passengers: true,
          vehicleType: true,
          budgetVnd: true,
          notes: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      // #842: trip-planner chat history (persisted only for signed-in customers).
      plannerConversations: {
        select: {
          title: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            select: { role: true, text: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });

  return customer;
}
