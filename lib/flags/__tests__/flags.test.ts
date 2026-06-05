/**
 * Unit tests for lib/flags (Issue 060).
 *
 * Mock-prisma + writeAdminAuditLog; manipulate process.env + __clearFlagCache
 * between cases. Covers:
 *   - env override wins over DB
 *   - DB value returned when no env override; default when neither exists
 *   - cache: two reads within TTL hit DB once; refetch after __clearFlagCache
 *   - setFlag upserts + writes an AdminAuditLog row + invalidates cache
 *   - resolution-order documentation present
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { mockWriteAudit } = vi.hoisted(() => ({ mockWriteAudit: vi.fn() }));
vi.mock('@/lib/audit/adminAuditLog', () => ({ writeAdminAuditLog: mockWriteAudit }));
// Stub the db singleton so importing flags.ts doesn't construct a real
// PrismaClient (needs DATABASE_URL). Every test injects its own client anyway.
vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));

import { getFlag, getFlagValue, setFlag, envKey, __clearFlagCache } from '../flags';
import { FLAG_KEYS } from '../keys';

/** Reader mock: a single FeatureFlag.findUnique stub. */
function makeReader(row: { enabled: boolean; value: string | null } | null) {
  return {
    featureFlag: {
      findUnique: vi.fn().mockResolvedValue(row),
    },
  };
}

/** Writer mock: $transaction(cb) + tx.featureFlag.upsert + tx for the audit log. */
function makeWriter() {
  const tx = {
    featureFlag: { upsert: vi.fn().mockResolvedValue(undefined) },
    // adminAuditLog surface the real writeAdminAuditLog would use (mocked here).
    adminAuditLog: { create: vi.fn().mockResolvedValue(undefined) },
  };
  const prisma = {
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  return { prisma, tx };
}

const MOMO = FLAG_KEYS.RAIL_MOMO_ENABLED; // 'rail.momo.enabled'
const MOMO_ENV = 'FEATURE_RAIL_MOMO_ENABLED';

beforeEach(() => {
  vi.clearAllMocks();
  __clearFlagCache();
  delete process.env[MOMO_ENV];
  mockWriteAudit.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env[MOMO_ENV];
});

describe('envKey', () => {
  it('uppercases + replaces dots/dashes with underscores + prefixes FEATURE_', () => {
    expect(envKey('rail.momo.enabled')).toBe('FEATURE_RAIL_MOMO_ENABLED');
    expect(envKey('killswitch-booking')).toBe('FEATURE_KILLSWITCH_BOOKING');
  });
});

describe('getFlag resolution order', () => {
  it('env override wins over DB (env=false beats DB enabled=true)', async () => {
    process.env[MOMO_ENV] = 'false';
    const reader = makeReader({ enabled: true, value: null });

    const result = await getFlag(MOMO, undefined, reader as never);

    expect(result).toBe(false);
    // Env override bypasses the DB entirely.
    expect(reader.featureFlag.findUnique).not.toHaveBeenCalled();
  });

  it('env override true is honored too', async () => {
    process.env[MOMO_ENV] = 'true';
    const reader = makeReader({ enabled: false, value: null });
    expect(await getFlag(MOMO, undefined, reader as never)).toBe(true);
    expect(reader.featureFlag.findUnique).not.toHaveBeenCalled();
  });

  it('returns the DB enabled value when no env override is set', async () => {
    const reader = makeReader({ enabled: true, value: null });
    expect(await getFlag(MOMO, undefined, reader as never)).toBe(true);
    expect(reader.featureFlag.findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns the default when neither env override nor DB row exists', async () => {
    const reader = makeReader(null);
    expect(await getFlag(MOMO, { default: true }, reader as never)).toBe(true);
    // No opts.default → false.
    expect(await getFlag(MOMO, undefined, makeReader(null) as never)).toBe(false);
  });

  it('ignores an unparseable env value and falls through to DB', async () => {
    process.env[MOMO_ENV] = 'garbage';
    const reader = makeReader({ enabled: true, value: null });
    expect(await getFlag(MOMO, undefined, reader as never)).toBe(true);
    expect(reader.featureFlag.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe('getFlag cache', () => {
  it('two reads within TTL hit the DB once', async () => {
    const reader = makeReader({ enabled: true, value: null });

    await getFlag(MOMO, undefined, reader as never);
    await getFlag(MOMO, undefined, reader as never);

    expect(reader.featureFlag.findUnique).toHaveBeenCalledTimes(1);
  });

  it('refetches after __clearFlagCache', async () => {
    const reader = makeReader({ enabled: true, value: null });

    await getFlag(MOMO, undefined, reader as never);
    __clearFlagCache();
    await getFlag(MOMO, undefined, reader as never);

    expect(reader.featureFlag.findUnique).toHaveBeenCalledTimes(2);
  });

  it('does not cache an absent row (re-reads until the flag exists)', async () => {
    const reader = makeReader(null);
    await getFlag(MOMO, undefined, reader as never);
    await getFlag(MOMO, undefined, reader as never);
    expect(reader.featureFlag.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe('getFlagValue', () => {
  it('returns the DB value (cached), null when absent', async () => {
    const reader = makeReader({ enabled: true, value: '{"variant":"b"}' });
    expect(await getFlagValue(MOMO, reader as never)).toBe('{"variant":"b"}');

    // Clear so the absent-row case isn't served the cached value above.
    __clearFlagCache();
    expect(await getFlagValue(MOMO, makeReader(null) as never)).toBeNull();
  });
});

describe('setFlag', () => {
  it('upserts the row + writes an AdminAuditLog row + invalidates cache', async () => {
    const { prisma, tx } = makeWriter();

    await setFlag(prisma as never, {
      key: MOMO,
      enabled: true,
      value: null,
      actor: 'admin:super-1',
    });

    expect(tx.featureFlag.upsert).toHaveBeenCalledWith({
      where: { key: MOMO },
      create: { key: MOMO, enabled: true, value: null, updatedBy: 'admin:super-1' },
      update: { enabled: true, value: null, updatedBy: 'admin:super-1' },
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(tx, {
      actor: 'admin:super-1',
      action: 'set-feature-flag',
      target: MOMO,
      argsRedacted: JSON.stringify({ enabled: true, value: null }),
    });
  });

  it('invalidation: a getFlag after setFlag sees the new DB value', async () => {
    // Prime the cache with enabled=false.
    const readerBefore = makeReader({ enabled: false, value: null });
    expect(await getFlag(MOMO, undefined, readerBefore as never)).toBe(false);

    // setFlag invalidates the cache entry for MOMO.
    const { prisma } = makeWriter();
    await setFlag(prisma as never, { key: MOMO, enabled: true, actor: 'admin:1' });

    // Next read hits the DB again (cache was invalidated) and sees enabled=true.
    const readerAfter = makeReader({ enabled: true, value: null });
    expect(await getFlag(MOMO, undefined, readerAfter as never)).toBe(true);
    expect(readerAfter.featureFlag.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe('documentation', () => {
  it('flags.ts documents the resolution order and the env-stays-env / FeeConfig-not-a-flag scope', () => {
    const src = readFileSync(join(__dirname, '..', 'flags.ts'), 'utf8');
    expect(src).toMatch(/RESOLUTION ORDER/);
    expect(src).toMatch(/ENV OVERRIDE/);
    expect(src).toMatch(/PAYMENTS_STUB/);
    expect(src).toMatch(/FeeConfig/);
  });
});
