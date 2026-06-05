/**
 * Prisma `select` shapes for Booking queries.
 *
 * Extracted from bookingRepo so unit tests can assert UI-contract fields
 * without pulling the prisma client (which requires DATABASE_URL at module
 * load).
 *
 * Rule (Mistake Log 2026-05-17): `select` whitelist == exactly the UI
 * contract fields. No filter-only columns (`salesClosed`, internal `status`
 * variants). No financial fields (`bankAccount`, `takeRate`). No access keys
 * (`confirmationToken` — that lives in the URL, never re-rendered).
 */

import type { Prisma } from '@prisma/client';

export const bookingDetailSelect = {
  id: true,
  bookingRef: true,
  buyerName: true,
  buyerPhone: true,
  buyerEmail: true,
  ticketCount: true,
  totalVnd: true,
  paymentMethod: true,
  status: true,
  createdAt: true,
  trip: {
    select: {
      id: true,
      departureAt: true,
      price: true,
      route: { select: { origin: true, destination: true } },
      bus: {
        select: {
          licensePlate: true,
          operator: { select: { legalName: true, contactPhone: true } },
        },
      },
    },
  },
} as const satisfies Prisma.BookingSelect;

export type BookingFullDetails = Prisma.BookingGetPayload<{
  select: typeof bookingDetailSelect;
}>;
