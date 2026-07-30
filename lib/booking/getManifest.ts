/**
 * getManifest — boarding manifest for a trip (Issue 014 AC6).
 *
 * Returns rows: { name, phone, ticketCount, pickupKind, pickupDetail, customPickupRequested,
 *                 contactStatus, paymentStatus, pickedUpAt, escalatedAt, ... } — see
 *                 ManifestRow below for the authoritative shape.
 *
 * (#366: this list previously named `pickupAreaLabel`, a field of the OperatorPickupArea
 * subsystem removed in issue 104. No code references it: zero occurrences in `schema.prisma`,
 * and the only occurrence in any TypeScript source under `lib/`, `app/` or `components/` is
 * this sentence. That is the extent of what was checked, and the claim is deliberately no
 * broader — past-tense mentions still exist in migrations and in `lib/geo/data/PROVENANCE.md`,
 * which is correct, since those describe history. The list also omitted
 * `customPickupRequested`, which does exist. Comment drift, not a code defect.)
 * AC6: NO seatNumber field in output.
 *
 * Tenant-isolated via Trip.operatorId join.
 * Includes paid bookings.
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';

export interface ManifestRow {
  bookingId: string;
  bookingRef: string;
  name: string;
  phone: string;
  ticketCount: number;
  /** Issue 104/111: traveler pickup. station = bus station; custom = off-list request. */
  pickupKind: 'station' | 'custom';
  pickupDetail: string | null;
  /** Issue 111: true ⇔ pickupKind=custom — the "Cần liên hệ" highlight trigger (gated on contactStatus=pending). */
  customPickupRequested: boolean;
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
  // AC6: NO seatNumber field
}

export interface GetManifestResult {
  tripId: string;
  rows: ManifestRow[];
  generatedAt: string; // ISO 8601 — for "Last updated" display (AC7)
}

const MANIFEST_PAYMENT_STATUSES = [
  'paid',
  'completed',
] as const;

export async function getManifest(
  operatorId: string,
  tripId: string
): Promise<GetManifestResult | null> {
  // Verify trip exists and belongs to operator
  const trip = await prisma.trip.findFirst({
    ...withOperatorScope(operatorId, { where: { id: tripId } }),
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
      status: true,
      isManual: true,
      pickedUpAt: true,
      escalatedAt: true,
      checkedInAt: true,
      noShowAt: true,
      pickupKind: true,
      pickupDetail: true,
      customPickupRequested: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const rows: ManifestRow[] = bookings.map((b) => ({
    bookingId: b.id,
    bookingRef: b.bookingRef,
    name: b.buyerName,
    phone: b.buyerPhone,
    ticketCount: b.ticketCount,
    pickupKind: b.pickupKind as ManifestRow['pickupKind'],
    pickupDetail: b.pickupDetail,
    customPickupRequested: b.customPickupRequested,
    contactStatus: b.contactStatus as ManifestRow['contactStatus'],
    paymentStatus: b.status,
    pickedUpAt: b.pickedUpAt ? b.pickedUpAt.toISOString() : null,
    escalatedAt: b.escalatedAt ? b.escalatedAt.toISOString() : null,
    checkedInAt: b.checkedInAt ? b.checkedInAt.toISOString() : null,
    noShowAt: b.noShowAt ? b.noShowAt.toISOString() : null,
    manualFlag: b.isManual,
    // AC6: no seatNumber field
  }));

  return {
    tripId,
    rows,
    generatedAt: new Date().toISOString(),
  };
}
