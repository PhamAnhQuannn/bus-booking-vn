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

/**
 * A public-pool charter lead as shown to ANY APPROVED operator (Issue 084) — NO
 * customer contact. The contact surface is revealed only after the operator WINS
 * the claim (the row becomes ACCEPTED and surfaces in getAcceptedCharters). The
 * claimByAt deadline IS shown so operators can gauge urgency.
 */
export interface PublicPoolCharter {
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
  /** Public-pool claim deadline (Issue 084). */
  claimByAt: Date | null;
  createdAt: Date;
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

/**
 * Issue 084: the PUBLIC POOL — PUBLISHED, unclaimed, not-yet-expired charter leads
 * visible to ANY APPROVED operator (the route + page gate APPROVED; this query is
 * NOT operator-scoped — the whole point is a shared pool). Customer contact is
 * DELIBERATELY withheld (revealed only after a winning claim flips the row to
 * ACCEPTED — see getAcceptedCharters). Newest-first (createdAt desc).
 *
 * The `claimByAt > now` predicate excludes expired pool items so an operator never
 * sees (and so never wastes a claim on) a lead that claimCharter would reject.
 * `now` is read at call time — this is a lib function, not an RSC render body, so
 * the non-purity is at the correct boundary (AGENTS.md Issue 016).
 *
 * Cursor pagination: pass the last row's `id` as `cursor` to page; `limit` caps
 * the page (default 50, the typical pool size for a single console view).
 */
export async function getPublicPoolCharters(
  prisma: PrismaClient,
  { limit = 50, cursor }: { limit?: number; cursor?: string } = {},
): Promise<PublicPoolCharter[]> {
  const now = new Date();
  const rows = await prisma.charterRequest.findMany({
    where: {
      status: 'PUBLISHED',
      assigneeOperatorId: null,
      OR: [{ claimByAt: null }, { claimByAt: { gt: now } }],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
      claimByAt: true,
      createdAt: true,
      originPlace: { select: { canonicalName: true } },
      // NOTE: contactName / contactPhone / contactEmail are NOT selected — the
      // pool is pre-claim, so customer PII stays hidden until a claim wins.
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
    claimByAt: row.claimByAt,
    createdAt: row.createdAt,
  }));
}
