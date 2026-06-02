/**
 * Unit tests for the FeeConfig read helper (issue 048).
 *
 * getEffectiveFeeRate takes an injectable client, so no vi.mock is needed —
 * we hand it a fake { feeConfig: { findMany } } returning the rows under test.
 */

import { describe, it, expect, vi } from 'vitest';

// feeConfig.ts imports the shared prisma client at module load (which would
// construct a real PG Pool needing DATABASE_URL). The helper takes an injectable
// client, so the default is never exercised here — stub it to an empty object.
vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { getEffectiveFeeRate, applyFeePpm } from '../feeConfig';

interface Row {
  operatorId: string | null;
  ratePpm: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

/** Build a fake FeeConfigReader whose findMany returns the given rows. */
function fakeClient(rows: Row[]) {
  return { feeConfig: { findMany: async () => rows } };
}

const CUTOVER = new Date('2020-01-01T00:00:00Z');
const GLOBAL_ROW: Row = {
  operatorId: null,
  ratePpm: 60000,
  effectiveFrom: CUTOVER,
  effectiveTo: null,
};

describe('getEffectiveFeeRate — global resolution', () => {
  it('returns the global 6% (60000 ppm) when only the cutover global row covers the date', async () => {
    const rate = await getEffectiveFeeRate(null, new Date('2026-06-02T00:00:00Z'), fakeClient([GLOBAL_ROW]));
    expect(rate).toBe(60000);
  });
});

describe('getEffectiveFeeRate — override-then-global', () => {
  const OP = 'op_X';
  const overrideFrom = new Date('2026-01-01T00:00:00Z');
  const OVERRIDE_ROW: Row = {
    operatorId: OP,
    ratePpm: 40000, // 4% override
    effectiveFrom: overrideFrom,
    effectiveTo: null,
  };

  it('per-operator override wins over the global row inside its effective window', async () => {
    // findMany would return both global + override for op_X at this time.
    const rate = await getEffectiveFeeRate(OP, new Date('2026-06-02T00:00:00Z'), fakeClient([GLOBAL_ROW, OVERRIDE_ROW]));
    expect(rate).toBe(40000);
  });

  it('a different operator with no override falls back to global', async () => {
    // For op_Y the query would NOT return op_X's override — only the global.
    const rate = await getEffectiveFeeRate('op_Y', new Date('2026-06-02T00:00:00Z'), fakeClient([GLOBAL_ROW]));
    expect(rate).toBe(60000);
  });

  it('picks the override with the latest effectiveFrom among multiple override rows', async () => {
    const newer: Row = { operatorId: OP, ratePpm: 30000, effectiveFrom: new Date('2026-05-01T00:00:00Z'), effectiveTo: null };
    const rate = await getEffectiveFeeRate(OP, new Date('2026-06-02T00:00:00Z'), fakeClient([GLOBAL_ROW, OVERRIDE_ROW, newer]));
    expect(rate).toBe(30000);
  });
});

describe('getEffectiveFeeRate — no covering row', () => {
  it('throws (rather than silently defaulting) when no FeeConfig row matches', async () => {
    await expect(getEffectiveFeeRate(null, new Date('2019-01-01T00:00:00Z'), fakeClient([]))).rejects.toThrow(
      /no FeeConfig row covers/
    );
  });
});

describe('applyFeePpm — exact BigInt fee math', () => {
  it('computes 6% of 250,000 = 15,000 (no float)', () => {
    expect(applyFeePpm(BigInt(250000), 60000)).toBe(BigInt(15000));
  });

  it('stays exact for a full-bus-scale VND value (floor/truncation toward zero)', () => {
    // 99,999,999,999 * 60000 / 1_000_000 = 5,999,999,999.94 → floored 5,999,999,999
    expect(applyFeePpm(BigInt('99999999999'), 60000)).toBe(BigInt('5999999999'));
  });

  it('returns a bigint', () => {
    expect(typeof applyFeePpm(BigInt(1000), 60000)).toBe('bigint');
  });
});
