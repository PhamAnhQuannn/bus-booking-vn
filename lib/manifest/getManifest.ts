/**
 * getManifest — boarding manifest for a trip (Issue 014 AC6).
 *
 * Returns rows: { name, phone, ticketCount, pickupPointName, contactStatus,
 *                 paymentStatus, manualFlag, cashFlag }.
 * AC6: NO seatNumber field in output.
 *
 * Tenant-isolated via Trip.operatorId join.
 * Includes paid + pending_cash_payment bookings.
 */

import { prisma } from '@/lib/db/client';

export interface ManifestRow {
  bookingId: string;
  bookingRef: string;
  name: string;
  phone: string;
  ticketCount: number;
  pickupPointName: string | null;
  contactStatus: 'pending' | 'reached' | 'no_answer' | 'callback';
  paymentStatus: string;
  pickedUpAt: string | null; // ISO 8601
  escalatedAt: string | null; // ISO 8601
  /** Issue 073: boarding check-in timestamp (ISO 8601); null = not boarded. */
  checkedInAt: string | null;
  /** Issue 073: no-show timestamp (ISO 8601); null = not marked no-show. */
  noShowAt: string | null;
  /** true when isManual=true */
  manualFlag: boolean;
  /** true when paymentMethod='cash' */
  cashFlag: boolean;
  // AC6: NO seatNumber field
}

export interface GetManifestResult {
  tripId: string;
  rows: ManifestRow[];
  generatedAt: string; // ISO 8601 — for "Last updated" display (AC7)
}

const MANIFEST_PAYMENT_STATUSES = [
  'paid',
  'pending_cash_payment',
  'completed',
] as const;

export async function getManifest(
  operatorId: string,
  tripId: string
): Promise<GetManifestResult | null> {
  // Verify trip exists and belongs to operator
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, operatorId },
    select: { id: true },
  });

  if (!trip) return null;

  const bookings = await prisma.booking.findMany({
    where: {
      tripId,
      status: { in: [...MANIFEST_PAYMENT_STATUSES] },
    },
    select: {
      id: true,
      bookingRef: true,
      buyerName: true,
      buyerPhone: true,
      ticketCount: true,
      contactStatus: true,
      paymentMethod: true,
      status: true,
      isManual: true,
      pickedUpAt: true,
      escalatedAt: true,
      checkedInAt: true,
      noShowAt: true,
      pickupPoint: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const rows: ManifestRow[] = bookings.map((b) => ({
    bookingId: b.id,
    bookingRef: b.bookingRef,
    name: b.buyerName,
    phone: b.buyerPhone,
    ticketCount: b.ticketCount,
    pickupPointName: b.pickupPoint?.name ?? null,
    contactStatus: b.contactStatus as ManifestRow['contactStatus'],
    paymentStatus: b.status,
    pickedUpAt: b.pickedUpAt ? b.pickedUpAt.toISOString() : null,
    escalatedAt: b.escalatedAt ? b.escalatedAt.toISOString() : null,
    checkedInAt: b.checkedInAt ? b.checkedInAt.toISOString() : null,
    noShowAt: b.noShowAt ? b.noShowAt.toISOString() : null,
    manualFlag: b.isManual,
    cashFlag: b.paymentMethod === 'cash',
    // AC6: no seatNumber field
  }));

  return {
    tripId,
    rows,
    generatedAt: new Date().toISOString(),
  };
}
