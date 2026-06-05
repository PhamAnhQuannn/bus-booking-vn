/**
 * getModerationQueue — admin Moderation tab read queries (Issue 069, Part D).
 *
 * In-process Prisma reads (NEVER self-fetch — AGENTS.md Issue 002/003).
 *
 *   getOpenReports   — the OPEN ContentReport queue, cursor/seek paginated on
 *                      (createdAt DESC, id DESC). Cursor is the opaque last-row id.
 *   getModeratedItems — the currently-disabled trips + routes (moderatedAt not
 *                      null). Small lists (take 50) — no pagination. Trips carry a
 *                      human label (route origin→dest + departureAt) for the UI.
 */

import { prisma as defaultPrisma } from '@/lib/core/db/client';

export interface OpenReport {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  reportedBy: string | null;
  createdAt: Date;
}

export interface GetOpenReportsParams {
  cursor?: string;
  limit?: number;
}

export interface GetOpenReportsResult {
  items: OpenReport[];
  nextCursor: string | null;
}

/** Minimal prisma surface — lets unit tests inject a findMany stub. */
type ReportsPrismaLike = Pick<typeof defaultPrisma, 'contentReport'>;

export async function getOpenReports(
  { cursor, limit = 20 }: GetOpenReportsParams = {},
  prisma: ReportsPrismaLike = defaultPrisma
): Promise<GetOpenReportsResult> {
  const take = Math.min(Math.max(limit, 1), 100);

  const rows = await prisma.contentReport.findMany({
    where: { status: 'open' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const items: OpenReport[] = page.map((r) => ({
    id: r.id,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    reportedBy: r.reportedBy,
    createdAt: r.createdAt,
  }));

  return { items, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null };
}

export interface ModeratedTrip {
  id: string;
  label: string;
  departureAt: Date;
}

export interface ModeratedRoute {
  id: string;
  origin: string;
  destination: string;
}

export interface ModeratedItems {
  trips: ModeratedTrip[];
  routes: ModeratedRoute[];
}

/** Minimal prisma surface — lets unit tests inject trip/route findMany stubs. */
type ItemsPrismaLike = Pick<typeof defaultPrisma, 'trip' | 'route'>;

export async function getModeratedItems(
  prisma: ItemsPrismaLike = defaultPrisma
): Promise<ModeratedItems> {
  const [tripRows, routeRows] = await Promise.all([
    prisma.trip.findMany({
      where: { moderatedAt: { not: null } },
      orderBy: [{ moderatedAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        departureAt: true,
        route: { select: { origin: true, destination: true } },
      },
    }),
    prisma.route.findMany({
      where: { moderatedAt: { not: null } },
      orderBy: [{ moderatedAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: { id: true, origin: true, destination: true },
    }),
  ]);

  const trips: ModeratedTrip[] = tripRows.map((t) => ({
    id: t.id,
    label: `${t.route.origin} → ${t.route.destination}`,
    departureAt: t.departureAt,
  }));

  const routes: ModeratedRoute[] = routeRows.map((r) => ({
    id: r.id,
    origin: r.origin,
    destination: r.destination,
  }));

  return { trips, routes };
}
