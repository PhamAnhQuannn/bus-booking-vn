/**
 * Place repository (Issue 044, SYS20).
 *
 * Place is a GLOBAL entity — a single registry of canonical bookable place
 * names shared across all operators. There is intentionally NO tenant-scope
 * helper here: a place name ("Hà Nội") is the same place regardless of which
 * operator's route references it.
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';

export interface ResolvedPlace {
  id: string;
  canonicalName: string;
}

/**
 * Resolve a place by name (case-insensitive, trimmed), matching against either
 * `canonicalName` OR any entry in `aliases`. Creates a new Place if no match.
 *
 * canonicalName is NOT unique (alias merges can legitimately share names across
 * historical rows), so the concurrency story is best-effort: on the rare race
 * where two requests create the same name simultaneously we tolerate a duplicate
 * Place row rather than failing the request — a later manual alias-merge can
 * fold them. We still re-read on any create error to recover the winning row.
 */
export async function resolveOrCreatePlace(name: string): Promise<ResolvedPlace> {
  const trimmed = name.trim();

  const existing = await findByNameOrAlias(trimmed);
  if (existing) return existing;

  try {
    const created = await prisma.place.create({
      data: { canonicalName: trimmed, aliases: [] },
      select: { id: true, canonicalName: true },
    });
    return created;
  } catch {
    // Tolerate races: re-read; if a concurrent writer landed the row first,
    // return it. (canonicalName isn't unique so this catch is defensive only.)
    const reread = await findByNameOrAlias(trimmed);
    if (reread) return reread;
    throw new Error(`resolveOrCreatePlace: failed to resolve or create "${trimmed}"`);
  }
}

/**
 * Case-insensitive match on canonicalName OR membership in aliases[].
 * Single query path via raw SQL (lower() compare + ANY over the array).
 */
async function findByNameOrAlias(trimmed: string): Promise<ResolvedPlace | null> {
  const rows = await prisma.$queryRaw<ResolvedPlace[]>(
    Prisma.sql`
      SELECT "id", "canonicalName"
      FROM "Place"
      WHERE lower("canonicalName") = lower(${trimmed})
         OR EXISTS (
           SELECT 1 FROM unnest("aliases") AS a
           WHERE lower(a) = lower(${trimmed})
         )
      LIMIT 1
    `
  );
  return rows[0] ?? null;
}

/**
 * All searchable place strings: canonicalName ∪ aliases, distinct, ordered ASC.
 * Feeds the search-form typeahead datalist.
 */
export async function listSearchablePlaces(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ place: string }[]>(
    Prisma.sql`
      SELECT "canonicalName" AS place FROM "Place"
      UNION
      SELECT unnest("aliases") AS place FROM "Place"
      ORDER BY place ASC
    `
  );
  return rows.map((r) => r.place);
}
