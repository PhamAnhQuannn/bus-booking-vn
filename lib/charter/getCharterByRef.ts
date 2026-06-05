/**
 * Issue 082: in-process charter-request read keyed by the public ref.
 *
 * Feeds the public status page (app/charter/status/[ref]/page.tsx) and the
 * ref-keyed cancel route. Server components / route handlers call this directly —
 * NEVER self-fetch their own API (Mistake Log 2026-05-17, Issue 002/003).
 *
 * REF AS ACCESS KEY: the ref is a random CH-YYYY-XXXXXX (36^6 ≈ 2.1B/year) — hard
 * to enumerate. For a lead-gen request (no payment, no PII beyond contact details
 * the customer themselves submitted), a ref-only access key is acceptable; we do
 * not gate the status page behind a session. The assignee operator's contact
 * surface is only exposed once status === ACCEPTED.
 *
 * Returns null when no row matches the ref (page → notFound()).
 */

import type { PrismaClient, CharterStatus } from '@prisma/client';

export interface CharterByRef {
  id: string;
  ref: string;
  status: CharterStatus;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  originName: string | null;
  destinations: string[];
  startDate: Date;
  endDate: Date | null;
  durationDays: number | null;
  passengers: number;
  vehicleType: string;
  budgetVnd: number | null;
  notes: string | null;
  createdAt: Date;
  /** Operator contact — populated ONLY when status === ACCEPTED and an assignee is set. */
  operator: { legalName: string; contactPhone: string } | null;
}

export async function getCharterByRef(
  prisma: PrismaClient,
  ref: string
): Promise<CharterByRef | null> {
  const row = await prisma.charterRequest.findUnique({
    where: { ref },
    select: {
      id: true,
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
      originPlace: { select: { canonicalName: true } },
      assigneeOperator: { select: { legalName: true, contactPhone: true } },
    },
  });

  if (!row) return null;

  // destinations is stored as a JSON string array (see createCharterRequest).
  const destinations = Array.isArray(row.destinations)
    ? (row.destinations as unknown[]).filter((d): d is string => typeof d === 'string')
    : [];

  // Only surface operator contact once the lead is matched (ACCEPTED).
  const operator =
    row.status === 'ACCEPTED' && row.assigneeOperator
      ? {
          legalName: row.assigneeOperator.legalName,
          contactPhone: row.assigneeOperator.contactPhone,
        }
      : null;

  return {
    id: row.id,
    ref: row.ref,
    status: row.status,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    originName: row.originPlace?.canonicalName ?? null,
    destinations,
    startDate: row.startDate,
    endDate: row.endDate,
    durationDays: row.durationDays,
    passengers: row.passengers,
    vehicleType: row.vehicleType,
    budgetVnd: row.budgetVnd,
    notes: row.notes,
    createdAt: row.createdAt,
    operator,
  };
}
