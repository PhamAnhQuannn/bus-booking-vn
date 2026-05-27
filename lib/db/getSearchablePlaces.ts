/**
 * Distinct, bookable place names (origins + destinations of active routes) for
 * the search-form typeahead suggestions. Diacritic-ordered, deduped across both
 * columns. Cheap query — feeds a native <datalist> on the origin/destination inputs.
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';

export async function getSearchablePlaces(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ place: string }[]>(
    Prisma.sql`
      SELECT origin AS place FROM "Route" WHERE "deactivatedAt" IS NULL
      UNION
      SELECT destination AS place FROM "Route" WHERE "deactivatedAt" IS NULL
      ORDER BY place ASC
    `
  );
  return rows.map((r) => r.place);
}
