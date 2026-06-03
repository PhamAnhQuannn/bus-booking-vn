/**
 * listAllOperators — admin Operators tab list (Issue 067, Part D).
 *
 * In-process Prisma read (NEVER self-fetch — AGENTS.md Issue 002/003). Cursor/seek
 * paginated on (createdAt DESC, id DESC) with an optional OperatorStatus filter.
 *
 * The cursor is the opaque row id of the last item on the previous page (single-
 * table seek, Prisma `cursor: { id }` + `skip: 1`). createdAt is the primary sort
 * with id as a stable tiebreaker so two rows sharing a createdAt never duplicate /
 * skip across pages (mirrors searchUsers, Issue 066).
 *
 * Contact phone is masked via redactPhone() before leaving the DB — the admin needs
 * a glanceable contact, not raw PII.
 */

import type { OperatorStatus, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/db/client';
import { redactPhone } from '@/lib/audit/redactPhone';

export interface OperatorListItem {
  id: string;
  legalName: string;
  status: OperatorStatus;
  /** Masked contact phone (redactPhone). */
  contactMasked: string;
  createdAt: Date;
}

export interface ListAllOperatorsParams {
  /** Optional status filter. */
  status?: OperatorStatus;
  /** Opaque seek cursor — the id of the last row on the previous page. */
  cursor?: string;
  limit?: number;
}

export interface ListAllOperatorsResult {
  items: OperatorListItem[];
  nextCursor: string | null;
}

/** Minimal prisma surface — lets unit tests inject a findMany stub. */
type PrismaLike = Pick<typeof defaultPrisma, 'operator'>;

export async function listAllOperators(
  params: ListAllOperatorsParams,
  prisma: PrismaLike = defaultPrisma
): Promise<ListAllOperatorsResult> {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const cursor = params.cursor;

  const where: Prisma.OperatorWhereInput = params.status ? { status: params.status } : {};

  const rows = await prisma.operator.findMany({
    where,
    select: { id: true, legalName: true, contactPhone: true, status: true, createdAt: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items: OperatorListItem[] = page.map((row) => ({
    id: row.id,
    legalName: row.legalName,
    status: row.status,
    contactMasked: redactPhone(row.contactPhone),
    createdAt: row.createdAt,
  }));

  return { items, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null };
}
