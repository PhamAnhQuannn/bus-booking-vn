/**
 * DB-backed feature-flag store + cached read helper (Issue 060, SYS20).
 *
 * Runtime feature GATES only: payment-rail toggles + kill-switches (see keys.ts).
 *
 * ── WHAT IS *NOT* A FEATURE FLAG ───────────────────────────────────────────
 *   - Env `*_STUB` infra toggles (PAYMENTS_STUB / NOTIFY_STUB / STORAGE_STUB)
 *     STAY in lib/config/env.ts. They select the stub-vs-real adapter at
 *     deploy/build time and are read through getEnv() — NOT FeatureFlags.
 *   - FeeConfig (Issue 048) is effective-dated, append-audited config resolved
 *     by lib/ledger/feeConfig.ts — NOT a flag.
 * FeatureFlags are runtime feature gates + rail toggles + kill-switches only
 * (AC5).
 *
 * ── getFlag RESOLUTION ORDER (highest priority first) ──────────────────────
 *   1. ENV OVERRIDE (ops emergency kill-switch, bypasses DB + cache):
 *        process.env['FEATURE_' + envKey(key)] — e.g. rail.momo.enabled →
 *        FEATURE_RAIL_MOMO_ENABLED. If set to 'true'/'false', that value is
 *        returned immediately. Lets ops force a gate with zero DB access.
 *   2. DB (cached): the FeatureFlag row's `enabled`, served from an in-process
 *        TTL cache (FLAG_CACHE_TTL_MS). On a miss/expiry the row is fetched.
 *   3. DEFAULT: opts.default ?? false (when no env override and no DB row).
 *
 * ── CACHE ──────────────────────────────────────────────────────────────────
 * Module-level Map keyed by flag key; entries expire after FLAG_CACHE_TTL_MS.
 * Redis is an optional/future upgrade — in-process is acceptable here.
 * NOTE: multi-instance deploys can see up to TTL (30s) staleness on a DB-set
 * flag; that is acceptable for these non-critical gates. The ENV OVERRIDE is
 * the instant, cache-bypassing kill-switch when zero staleness is required.
 * __clearFlagCache() is exported for tests (and is called by setFlag after a
 * write so the next read of that key reflects the new value immediately
 * in-process).
 */

import { prisma } from '@/lib/db/client';
import { writeAdminAuditLog } from '@/lib/audit/adminAuditLog';

/** In-process cache TTL. Multi-instance deploys see up to this much staleness. */
export const FLAG_CACHE_TTL_MS = 30_000;

interface FlagCacheEntry {
  enabled: boolean;
  value: string | null;
  fetchedAt: number;
}

const flagCache = new Map<string, FlagCacheEntry>();

/**
 * Minimal prisma surface getFlag/getFlagValue need — eases mocking and lets a
 * tx handle stand in. `findUnique`'s arg is `any` so the real (typed) Prisma
 * method and a test stub are both assignable.
 */
export interface FeatureFlagReader {
  featureFlag: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique: (args: any) => Promise<FeatureFlagRow | null>;
  };
}

/**
 * Minimal prisma surface setFlag needs: an `upsert` on FeatureFlag plus the
 * adminAuditLog.create surface (via writeAdminAuditLog) and $transaction.
 */
export interface FeatureFlagWriter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
}

interface FeatureFlagRow {
  enabled: boolean;
  value: string | null;
}

/**
 * Translate a flag key to its env-override variable name.
 * Uppercases, replaces dots/dashes with underscores, prefixes FEATURE_.
 *   rail.momo.enabled → FEATURE_RAIL_MOMO_ENABLED
 */
export function envKey(key: string): string {
  return 'FEATURE_' + key.toUpperCase().replace(/[.-]/g, '_');
}

/**
 * Parse a 'true'/'false' env string. Returns undefined when unset/unparseable
 * (so the caller falls through to the next resolution layer rather than
 * treating an empty/garbage value as `false`).
 */
function parseEnvBool(raw: string | undefined): boolean | undefined {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

/**
 * Read the DB row for `key`, populating/serving the in-process TTL cache.
 * A cached null-row is represented by an entry with enabled=false,value=null —
 * but to keep "row absent" distinguishable for the DEFAULT layer, getFlag
 * tracks presence separately via the returned tuple.
 */
async function readDbCached(
  key: string,
  client: FeatureFlagReader
): Promise<{ enabled: boolean; value: string | null; present: boolean }> {
  const now = Date.now();
  const cached = flagCache.get(key);
  if (cached && now - cached.fetchedAt < FLAG_CACHE_TTL_MS) {
    // A cached entry always represents a real DB row (we only cache hits).
    return { enabled: cached.enabled, value: cached.value, present: true };
  }

  const row = await client.featureFlag.findUnique({
    where: { key },
    select: { enabled: true, value: true },
  });

  if (row === null) {
    // Do NOT cache absence — a flag is typically created shortly after first
    // read; caching the miss would hide it for a full TTL. Absent rows are
    // cheap point lookups, so re-reading until the row exists is acceptable.
    return { enabled: false, value: null, present: false };
  }

  flagCache.set(key, { enabled: row.enabled, value: row.value, fetchedAt: now });
  return { enabled: row.enabled, value: row.value, present: true };
}

/**
 * Resolve a boolean feature flag. See module header for the full resolution
 * order: env override → cached DB row → opts.default ?? false.
 */
export async function getFlag(
  key: string,
  opts?: { default?: boolean },
  client: FeatureFlagReader = prisma as unknown as FeatureFlagReader
): Promise<boolean> {
  // 1. Env override (highest priority, bypasses DB + cache).
  const envVal = parseEnvBool(process.env[envKey(key)]);
  if (envVal !== undefined) return envVal;

  // 2. DB (cached).
  const db = await readDbCached(key, client);
  if (db.present) return db.enabled;

  // 3. Default.
  return opts?.default ?? false;
}

/**
 * Resolve the optional structured `value` for a flag (DB value, cached).
 * Kept simple per AC: no env-override layer for the value — only `enabled` has
 * the emergency env override. Returns null when no DB row or no value set.
 */
export async function getFlagValue(
  key: string,
  client: FeatureFlagReader = prisma as unknown as FeatureFlagReader
): Promise<string | null> {
  const db = await readDbCached(key, client);
  return db.present ? db.value : null;
}

/**
 * Upsert a feature flag and append an AdminAuditLog row in one transaction,
 * then invalidate the in-process cache entry for `key`.
 *
 * `prisma` is taken as a param (reuse-by-param) so this runs under the app
 * singleton, a CLI PrismaClient, or a test client without importing globals.
 */
export async function setFlag(
  client: FeatureFlagWriter,
  input: { key: string; enabled: boolean; value?: string | null; actor: string }
): Promise<void> {
  const { key, enabled, value, actor } = input;

  await client.$transaction(async (tx) => {
    await tx.featureFlag.upsert({
      where: { key },
      create: { key, enabled, value: value ?? null, updatedBy: actor },
      update: { enabled, value: value ?? null, updatedBy: actor },
    });

    await writeAdminAuditLog(tx, {
      actor,
      action: 'set-feature-flag',
      target: key,
      argsRedacted: JSON.stringify({ enabled, value: value ?? null }),
    });
  });

  // Invalidate so the next read of this key reflects the new value in-process.
  flagCache.delete(key);
}

/** Clear the entire in-process flag cache. Test helper (and used by setFlag). */
export function __clearFlagCache(): void {
  flagCache.clear();
}
