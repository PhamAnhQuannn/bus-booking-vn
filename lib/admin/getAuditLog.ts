/**
 * getAuditLog + auditLogToCsv — read + export the IMMUTABLE AdminAuditLog (Issue
 * 062) for the System tab → Audit log section (Issue 070).
 *
 * In-process Prisma read (NEVER self-fetch — AGENTS.md Issue 002/003). The audit
 * log is append-only and never edited; this module is READ-ONLY.
 *
 * ── CURSOR (timestamp DESC, id DESC) ─────────────────────────────────────────
 * Newest-first, seek-paginated on (timestamp DESC, id DESC) — timestamp primary,
 * id as a stable tiebreaker (two rows can share a timestamp). The cursor is the
 * opaque last-row id (mirrors getPayoutQueue / listAllOperators). The composite
 * @@index([action, timestamp]) and @@index([timestamp]) back both the filtered and
 * unfiltered orderings.
 */

import { prisma as defaultPrisma } from '@/lib/core/db/client';

export interface AuditLogRow {
  id: string;
  timestamp: Date;
  actor: string;
  action: string;
  target: string;
  argsRedacted: string | null;
}

export interface GetAuditLogParams {
  /** Optional exact-action filter (e.g. 'set-feature-flag', 'revoke-admin'). */
  action?: string;
  /** Opaque seek cursor — the id of the last row on the previous page. */
  cursor?: string;
  limit?: number;
}

export interface GetAuditLogResult {
  items: AuditLogRow[];
  nextCursor: string | null;
}

/** Minimal prisma surface — lets unit tests inject an adminAuditLog.findMany stub. */
type PrismaLike = Pick<typeof defaultPrisma, 'adminAuditLog'>;

export async function getAuditLog(
  params: GetAuditLogParams,
  prisma: PrismaLike = defaultPrisma
): Promise<GetAuditLogResult> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 1000);
  const cursor = params.cursor;

  const rows = await prisma.adminAuditLog.findMany({
    where: params.action ? { action: params.action } : {},
    select: {
      id: true,
      timestamp: true,
      actor: true,
      action: true,
      target: true,
      argsRedacted: true,
    },
    orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: page.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      actor: row.actor,
      action: row.action,
      target: row.target,
      argsRedacted: row.argsRedacted,
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

/**
 * Escape a single CSV field per RFC 4180: wrap in double quotes and double any
 * internal double-quote. Wrapping unconditionally keeps embedded commas, quotes,
 * and newlines safe regardless of content. A null field becomes an empty quoted
 * string.
 */
function csvField(value: string | null): string {
  const s = value ?? '';
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Serialize audit rows to a CSV string with the fixed header
 * `id,timestamp,actor,action,target,argsRedacted`. Pure function (no I/O, no
 * Date.now) — the timestamp is rendered as the row's own ISO-8601 instant. Rows
 * are emitted in the order given (caller controls ordering — newest-first).
 */
export function auditLogToCsv(rows: AuditLogRow[]): string {
  const header = 'id,timestamp,actor,action,target,argsRedacted';
  const lines = rows.map((r) =>
    [
      csvField(r.id),
      csvField(r.timestamp.toISOString()),
      csvField(r.actor),
      csvField(r.action),
      csvField(r.target),
      csvField(r.argsRedacted),
    ].join(',')
  );
  return [header, ...lines].join('\r\n');
}
