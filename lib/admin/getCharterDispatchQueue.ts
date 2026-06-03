/**
 * getCharterDispatchQueue — admin charter-dispatch reads (Issue 085).
 *
 * In-process Prisma reads (NEVER self-fetch — AGENTS.md Issue 002/003). Three
 * functions back the admin charter console:
 *
 *   - getCharterDispatchQueue: the FIFO dispatch queue — CharterRequests awaiting
 *     an admin routing decision (status = ADMIN_REVIEW), OLDEST first (createdAt
 *     ASC, id ASC tiebreak). Cursor/seek paginated. Full request detail (admin sees
 *     the raw contact details — these are a lead the admin is routing to an
 *     operator, not customer PII to mask). A `priorAssigneeOperatorId` flag carries
 *     reassign context: a request re-routed here from DECLINED/EXPIRED by the
 *     Issue-086 sweeper had its assignee cleared, but a request the admin is simply
 *     re-acting on may still show whom it was last with. (After 081 clears the
 *     assignee on DECLINED/EXPIRED this is usually null — kept on the DTO so the UI
 *     can surface it when present.)
 *   - getApprovedOperatorsForAssign: the assign-direct picker source — every
 *     APPROVED operator `{ id, legalName }`, legalName ASC.
 *   - getCharterById: full single-request detail incl. current status / assignee /
 *     timeout deadlines, for a status/detail view.
 *
 * destinations is stored as a JSON array of `{ placeId?, name }` descriptors (see
 * createCharterRequest); we pass it through as the raw Json value and let the UI
 * read the `name` field — mirrors how the operator/public surfaces read it.
 */

import type { CharterStatus, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/db/client';

export interface CharterDispatchItem {
  id: string;
  ref: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  originName: string | null;
  /** Raw JSON destinations array (`{ placeId?, name }[]`) as stored. */
  destinations: Prisma.JsonValue;
  startDate: Date;
  endDate: Date | null;
  durationDays: number | null;
  passengers: number;
  vehicleType: string;
  budgetVnd: number | null;
  notes: string | null;
  createdAt: Date;
  /**
   * Reassign context: the operator this lead was last assigned to, if the row
   * still carries one. Usually null for a freshly re-routed lead (081 clears the
   * assignee on DECLINED/EXPIRED) but surfaced when present.
   */
  priorAssigneeOperatorId: string | null;
  priorAssigneeName: string | null;
}

export interface GetCharterDispatchQueueParams {
  /** Opaque seek cursor — the id of the last row on the previous page. */
  cursor?: string;
  limit?: number;
}

export interface GetCharterDispatchQueueResult {
  items: CharterDispatchItem[];
  nextCursor: string | null;
}

export interface ApprovedOperatorOption {
  id: string;
  legalName: string;
}

export interface CharterDetail extends CharterDispatchItem {
  status: CharterStatus;
  assigneeOperatorId: string | null;
  assigneeName: string | null;
  publishedAt: Date | null;
  claimByAt: Date | null;
  acceptByAt: Date | null;
  rejectionReason: string | null;
}

/** Minimal prisma surface — lets unit tests inject findMany/findUnique stubs. */
type PrismaLike = Pick<typeof defaultPrisma, 'charterRequest' | 'operator'>;

const DISPATCH_SELECT = {
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
  createdAt: true,
  assigneeOperatorId: true,
  originPlace: { select: { canonicalName: true } },
  assigneeOperator: { select: { legalName: true } },
} as const;

/**
 * FIFO dispatch queue: CharterRequests in ADMIN_REVIEW, OLDEST first. Cursor/seek
 * paginated on (createdAt ASC, id ASC) — the inverse sort of the operator/admin
 * lists (which are newest-first) because dispatch is a work queue: the longest-
 * waiting lead is actioned first.
 */
export async function getCharterDispatchQueue(
  prisma: PrismaLike,
  params: GetCharterDispatchQueueParams = {}
): Promise<GetCharterDispatchQueueResult> {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const cursor = params.cursor;

  const rows = await prisma.charterRequest.findMany({
    where: { status: 'ADMIN_REVIEW' },
    select: DISPATCH_SELECT,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items = page.map(toDispatchItem);

  return { items, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null };
}

/** Every APPROVED operator as `{ id, legalName }`, legalName ASC — assign picker. */
export async function getApprovedOperatorsForAssign(
  prisma: PrismaLike
): Promise<ApprovedOperatorOption[]> {
  const rows = await prisma.operator.findMany({
    where: { status: 'APPROVED' },
    select: { id: true, legalName: true },
    orderBy: [{ legalName: 'asc' }],
  });
  return rows.map((r) => ({ id: r.id, legalName: r.legalName }));
}

/** Full detail for one charter request (any status), or null when not found. */
export async function getCharterById(
  prisma: PrismaLike,
  charterId: string
): Promise<CharterDetail | null> {
  const row = await prisma.charterRequest.findUnique({
    where: { id: charterId },
    select: {
      ...DISPATCH_SELECT,
      status: true,
      publishedAt: true,
      claimByAt: true,
      acceptByAt: true,
      rejectionReason: true,
    },
  });

  if (!row) return null;

  return {
    ...toDispatchItem(row),
    status: row.status,
    assigneeOperatorId: row.assigneeOperatorId,
    assigneeName: row.assigneeOperator?.legalName ?? null,
    publishedAt: row.publishedAt,
    claimByAt: row.claimByAt,
    acceptByAt: row.acceptByAt,
    rejectionReason: row.rejectionReason,
  };
}

type DispatchRow = {
  id: string;
  ref: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  destinations: Prisma.JsonValue;
  startDate: Date;
  endDate: Date | null;
  durationDays: number | null;
  passengers: number;
  vehicleType: string;
  budgetVnd: number | null;
  notes: string | null;
  createdAt: Date;
  assigneeOperatorId: string | null;
  originPlace: { canonicalName: string } | null;
  assigneeOperator: { legalName: string } | null;
};

function toDispatchItem(row: DispatchRow): CharterDispatchItem {
  return {
    id: row.id,
    ref: row.ref,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    originName: row.originPlace?.canonicalName ?? null,
    destinations: row.destinations,
    startDate: row.startDate,
    endDate: row.endDate,
    durationDays: row.durationDays,
    passengers: row.passengers,
    vehicleType: row.vehicleType,
    budgetVnd: row.budgetVnd,
    notes: row.notes,
    createdAt: row.createdAt,
    priorAssigneeOperatorId: row.assigneeOperatorId,
    priorAssigneeName: row.assigneeOperator?.legalName ?? null,
  };
}
