import { prisma } from '@/lib/core/db/client';
import { SEARCH_VISIBLE_STATUSES } from '@/lib/onboarding';

export interface PublicOperator {
  id: string;
  brandName: string | null;
  legalName: string;
  provinceName: string | null;
  routesSummary: string | null;
  topRoute: { origin: string; destination: string } | null;
}

export async function getPublicOperators(): Promise<PublicOperator[]> {
  const rows = await prisma.operator.findMany({
    where: { status: { in: SEARCH_VISIBLE_STATUSES }, disabledAt: null },
    select: {
      id: true,
      brandName: true,
      legalName: true,
      provinceName: true,
      routesSummary: true,
      routes: {
        where: { deactivatedAt: null, moderatedAt: null },
        select: { origin: true, destination: true },
        take: 1,
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((r) => ({
    id: r.id,
    brandName: r.brandName,
    legalName: r.legalName,
    provinceName: r.provinceName,
    routesSummary: r.routesSummary,
    topRoute: r.routes[0] ?? null,
  }));
}
