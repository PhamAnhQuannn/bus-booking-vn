/**
 * Issue 083: operator-side charter queries for the console Charter tab.
 *
 * Two reads, both scoped to a single operatorId (no cross-operator leak):
 *
 *  - getAssignedCharters → the directly-assigned, not-yet-actioned leads
 *    (status = ASSIGNED_DIRECT). REVEAL-ON-ACCEPT: the customer's contact
 *    details (contactName / contactPhone / contactEmail) are DELIBERATELY NOT
 *    selected — an operator deciding whether to accept sees only the request
 *    summary (route, dates, passengers, vehicle, budget, notes, deadline). The
 *    contact surface is unlocked only AFTER they accept (AC3, mirrors the public
 *    status page's reveal-on-ACCEPTED in getCharterByRef).
 *
 *  - getAcceptedCharters → the leads this operator has accepted (status =
 *    ACCEPTED). These DO include the customer contact + full details, because
 *    fulfillment happens off-platform and the operator now needs to reach the
 *    customer directly (AC3).
 *
 * In-process reads — server components call these directly, never self-fetch
 * (AGENTS.md 002/003). Both order newest-first (createdAt desc).
 */

import type { PrismaClient } from '@prisma/client';

/** A directly-assigned charter lead as shown to the deciding operator — NO contact. */
export interface AssignedCharter {
  id: string;
  ref: string;
  originName: string | null;
  destinations: string[];
  startDate: Date;
  endDate: Date | null;
  durationDays: number | null;
  passengers: number;
  vehicleType: string;
  budgetVnd: number | null;
  notes: string | null;
  /** Direct-assign accept deadline (Issue 083). */
  acceptByAt: Date | null;
  createdAt: Date;
}

/** An accepted charter — full details INCLUDING customer contact (off-platform fulfillment). */
export interface AcceptedCharter extends AssignedCharter {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

/** Stored destinations are a JSON array; coerce to a string[] of display names. */
function toDestinationNames(destinations: unknown): string[] {
  if (!Array.isArray(destinations)) return [];
  return destinations
    .map((d) => {
      if (typeof d === 'string') return d;
      if (d && typeof d === 'object' && 'name' in d && typeof (d as { name: unknown }).name === 'string') {
        return (d as { name: string }).name;
      }
      return null;
    })
    .filter((d): d is string => typeof d === 'string');
}

/**
 * Directly-assigned, not-yet-actioned charter leads for this operator. Contact
 * fields are intentionally withheld (reveal-on-accept — AC3).
 */
export async function getAssignedCharters(
  prisma: PrismaClient,
  operatorId: string
): Promise<AssignedCharter[]> {
  const rows = await prisma.charterRequest.findMany({
    where: { status: 'ASSIGNED_DIRECT', assigneeOperatorId: operatorId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      ref: true,
      destinations: true,
      startDate: true,
      endDate: true,
      durationDays: true,
      passengers: true,
      vehicleType: true,
      budgetVnd: true,
      notes: true,
      acceptByAt: true,
      createdAt: true,
      originPlace: { select: { canonicalName: true } },
      // NOTE: contactName / contactPhone / contactEmail are NOT selected here —
      // reveal-on-accept (AC3). Adding them would leak customer PII before the
      // operator commits to the lead.
    },
  });

  return rows.map((row) => ({
    id: row.id,
    ref: row.ref,
    originName: row.originPlace?.canonicalName ?? null,
    destinations: toDestinationNames(row.destinations),
    startDate: row.startDate,
    endDate: row.endDate,
    durationDays: row.durationDays,
    passengers: row.passengers,
    vehicleType: row.vehicleType,
    budgetVnd: row.budgetVnd,
    notes: row.notes,
    acceptByAt: row.acceptByAt,
    createdAt: row.createdAt,
  }));
}

/**
 * Charter leads this operator has ACCEPTED — full details INCLUDING customer
 * contact (the operator fulfills off-platform and must reach the customer).
 */
export async function getAcceptedCharters(
  prisma: PrismaClient,
  operatorId: string
): Promise<AcceptedCharter[]> {
  const rows = await prisma.charterRequest.findMany({
    where: { status: 'ACCEPTED', assigneeOperatorId: operatorId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      ref: true,
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
      acceptByAt: true,
      createdAt: true,
      originPlace: { select: { canonicalName: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    ref: row.ref,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    originName: row.originPlace?.canonicalName ?? null,
    destinations: toDestinationNames(row.destinations),
    startDate: row.startDate,
    endDate: row.endDate,
    durationDays: row.durationDays,
    passengers: row.passengers,
    vehicleType: row.vehicleType,
    budgetVnd: row.budgetVnd,
    notes: row.notes,
    acceptByAt: row.acceptByAt,
    createdAt: row.createdAt,
  }));
}
