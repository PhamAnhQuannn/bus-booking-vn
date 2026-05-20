/**
 * getCustomerBookingDetail — single booking detail for an authenticated
 * customer (Issue 009, PRD story 16).
 *
 * Access (locked decision Q3 — auth-only/strict): the query is scoped by BOTH
 * id AND customerId, so a customer can only ever read a booking attached to
 * their own account. A non-owned or non-existent id returns null (the route
 * maps that to 404 — never distinguish "not yours" from "doesn't exist").
 * Guests use the existing /booking/result/[token] confirmation-token path;
 * there is no confirmationToken access on this customer route.
 *
 * Returns route, departure, ticket count, buyer info, total, status, and the
 * operator contact phone (AC for story 16). No seat numbers.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import type { BookingPaymentStatus } from './bookingDto';

export const customerBookingDetailSelect = {
  id: true,
  bookingRef: true,
  customerId: true,
  buyerName: true,
  buyerPhone: true,
  ticketCount: true,
  totalVnd: true,
  paymentMethod: true,
  status: true,
  createdAt: true,
  trip: {
    select: {
      departureAt: true,
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

type CustomerBookingDetailRaw = Prisma.BookingGetPayload<{
  select: typeof customerBookingDetailSelect;
}>;

export interface CustomerBookingDetail {
  id: string;
  bookingRef: string;
  buyerName: string;
  buyerPhone: string;
  ticketCount: number;
  totalVnd: number;
  paymentMethod: 'cash' | 'momo' | 'zalopay' | 'card';
  status: BookingPaymentStatus;
  createdAt: string; // ISO 8601
  route: { origin: string; destination: string };
  departureAt: string; // ISO 8601
  busLicensePlate: string;
  operator: { legalName: string; contactPhone: string };
}

function toCustomerBookingDetail(row: CustomerBookingDetailRaw): CustomerBookingDetail {
  return {
    id: row.id,
    bookingRef: row.bookingRef,
    buyerName: row.buyerName,
    buyerPhone: row.buyerPhone,
    ticketCount: row.ticketCount,
    totalVnd: row.totalVnd,
    paymentMethod: row.paymentMethod as CustomerBookingDetail['paymentMethod'],
    status: row.status as BookingPaymentStatus,
    createdAt: row.createdAt.toISOString(),
    route: { origin: row.trip.route.origin, destination: row.trip.route.destination },
    departureAt: row.trip.departureAt.toISOString(),
    busLicensePlate: row.trip.bus.licensePlate,
    operator: {
      legalName: row.trip.bus.operator.legalName,
      contactPhone: row.trip.bus.operator.contactPhone,
    },
  };
}

export async function getCustomerBookingDetail(
  customerId: string,
  bookingId: string
): Promise<CustomerBookingDetail | null> {
  const row = await prisma.booking.findFirst({
    where: { id: bookingId, customerId },
    select: customerBookingDetailSelect,
  });
  return row ? toCustomerBookingDetail(row) : null;
}
