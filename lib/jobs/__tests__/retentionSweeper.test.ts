/**
 * Issue 090: unit tests for the retention sweeper core.
 *
 * The DB client, the storage layer (deleteObject), and the retention-policy
 * constants are mocked. The lock `tx` (the JobCore's first arg) is a stub:
 *   - $executeRaw returns the guest-scrub affected-row count,
 *   - $queryRaw returns the staged KYB candidate rows,
 *   - kybDocument.update records the purgedAt stamp.
 *
 * We assert the sweeper:
 *   - issues a single bulk guest-scrub UPDATE and counts its affected rows,
 *   - claims expired KYB docs and for each calls deleteObject + stamps purgedAt,
 *   - returns rowsAffected = guest-scrubbed + docs-purged,
 *   - is a no-op (0/0) when nothing is past the window.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- hoisted mocks ----
const { mockPrisma, mockDeleteObject } = vi.hoisted(() => ({
  mockPrisma: {},
  mockDeleteObject: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/storage', () => ({ deleteObject: mockDeleteObject }));
vi.mock('@/lib/account/retentionPolicy', () => ({
  GUEST_PII_RETENTION_DAYS: 365,
  KYB_DOC_RETENTION_DAYS: 90,
  ORPHAN_PAYMENT_PII_RETENTION_DAYS: 365,
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
// Prisma.sql passthrough — the stub tx ignores the SQL and returns staged values
// by call order.
vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@prisma/client')>();
  return {
    ...actual,
    Prisma: { ...actual.Prisma, sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ strings, vals }) },
  };
});

import { retentionSweeper } from '../retentionSweeper';

/**
 * Build a lock-tx stub.
 * @param guestCount  the affected-row count $executeRaw (guest scrub) resolves to
 * @param kybRows     the KYB candidate rows the FIRST $queryRaw (KYB claim) resolves to
 * @param orphanRows  the orphan rows the SECOND $queryRaw (#332 redact claim) resolves to
 *
 * The two arms share $executeRaw/$queryRaw, so $queryRaw is staged by call ORDER:
 * call 1 = KYB claim, call 2 = orphan-redact claim.
 */
function makeTx(guestCount: number, kybRows: unknown[], orphanRows: unknown[] = []) {
  const kybUpdate = vi.fn().mockResolvedValue({});
  const paymentEventUpdate = vi.fn().mockResolvedValue({});
  const queryRaw = vi
    .fn()
    .mockResolvedValueOnce(kybRows)
    .mockResolvedValueOnce(orphanRows);
  return {
    tx: {
      $executeRaw: vi.fn().mockResolvedValue(guestCount),
      $queryRaw: queryRaw,
      kybDocument: { update: kybUpdate },
      paymentEvent: { update: paymentEventUpdate },
    } as never,
    kybUpdate,
    paymentEventUpdate,
  };
}

const NOW = new Date('2026-06-03T03:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteObject.mockResolvedValue(undefined);
});

describe('retentionSweeper', () => {
  it('runs the bulk guest-scrub UPDATE and counts its affected rows', async () => {
    const { tx } = makeTx(4, []);
    const res = await retentionSweeper(tx, { now: NOW });

    expect((tx as unknown as { $executeRaw: ReturnType<typeof vi.fn> }).$executeRaw)
      .toHaveBeenCalledTimes(1);
    // No KYB candidates → only the guest scrub counts.
    expect(res).toEqual({ rowsAffected: 4, status: 'success' });
  });

  it('purges each expired KYB doc: deleteObject + stamps purgedAt', async () => {
    const kybRows = [
      { id: 'kyb_1', storageKey: 'kyb_doc/aaa/license.pdf' },
      { id: 'kyb_2', storageKey: 'kyb_doc/bbb/identity.pdf' },
    ];
    const { tx, kybUpdate } = makeTx(0, kybRows);

    const res = await retentionSweeper(tx, { now: NOW });

    // deleteObject called once per doc with the app prisma singleton + storageKey.
    expect(mockDeleteObject).toHaveBeenCalledTimes(2);
    expect(mockDeleteObject).toHaveBeenNthCalledWith(1, mockPrisma, 'kyb_doc/aaa/license.pdf');
    expect(mockDeleteObject).toHaveBeenNthCalledWith(2, mockPrisma, 'kyb_doc/bbb/identity.pdf');

    // purgedAt stamped on each row with the injected `now`.
    expect(kybUpdate).toHaveBeenCalledTimes(2);
    expect(kybUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'kyb_1' },
      data: { purgedAt: NOW },
    });
    expect(kybUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'kyb_2' },
      data: { purgedAt: NOW },
    });

    expect(res).toEqual({ rowsAffected: 2, status: 'success' });
  });

  it('sums guest scrubs + KYB purges into rowsAffected', async () => {
    const { tx } = makeTx(3, [{ id: 'kyb_x', storageKey: 'kyb_doc/x/y.pdf' }]);
    const res = await retentionSweeper(tx, { now: NOW });
    expect(res.rowsAffected).toBe(4); // 3 guest + 1 kyb
  });

  it('is a no-op (0/0) when nothing is past the window', async () => {
    const { tx, kybUpdate } = makeTx(0, []);
    const res = await retentionSweeper(tx, { now: NOW });
    expect(mockDeleteObject).not.toHaveBeenCalled();
    expect(kybUpdate).not.toHaveBeenCalled();
    expect(res).toEqual({ rowsAffected: 0, status: 'success' });
  });

  it('does NOT stamp purgedAt when deleteObject throws (loud failure, bytes-first)', async () => {
    const { tx, kybUpdate } = makeTx(0, [{ id: 'kyb_z', storageKey: 'kyb_doc/z/z.pdf' }]);
    mockDeleteObject.mockRejectedValueOnce(new Error('s3_delete_failed'));
    await expect(retentionSweeper(tx, { now: NOW })).rejects.toThrow('s3_delete_failed');
    // purgedAt must NOT be stamped if the object delete failed.
    expect(kybUpdate).not.toHaveBeenCalled();
  });

  // --- #332: orphan PaymentEvent PII redaction arm ---------------------------------
  const SEPAY_ORPHAN_BODY = JSON.stringify({
    id: 123,
    gateway: 'VCB',
    transactionDate: '2026-08-01 10:00:00',
    accountNumber: '0123456789', // OUR receiving account — KEPT (evidence)
    subAccount: '9988', // OUR virtual-account token — KEPT (evidence)
    code: null,
    content: 'NGUYEN VAN A chuyen tien', // payer-typed memo, may carry name — STRIPPED
    transferType: 'in',
    description: 'NGUYEN VAN A chuyen khoan', // payer name — STRIPPED
    transferAmount: 200000, // evidence — KEPT
    referenceCode: 'FT2026080112345', // evidence — KEPT
    accumulated: 5000000, // platform balance — STRIPPED
  });

  it('strips payer PII from an expired orphan rawBody, keeps evidence, stamps redactedAt', async () => {
    const { tx, paymentEventUpdate } = makeTx(0, [], [
      { id: 'pe_orphan_1', rawBody: SEPAY_ORPHAN_BODY },
    ]);
    const res = await retentionSweeper(tx, { now: NOW });

    expect(paymentEventUpdate).toHaveBeenCalledTimes(1);
    const call = paymentEventUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: { rawBody: string; redactedAt: Date };
    };
    expect(call.where).toEqual({ id: 'pe_orphan_1' });
    expect(call.data.redactedAt).toBe(NOW);

    const body = JSON.parse(call.data.rawBody);
    // Payer PII + platform balance nulled
    expect(body.description).toBeNull();
    expect(body.content).toBeNull();
    expect(body.accumulated).toBeNull();
    // Reconciliation evidence preserved — OUR receiving account + money keys
    expect(body.accountNumber).toBe('0123456789');
    expect(body.subAccount).toBe('9988');
    expect(body.transferAmount).toBe(200000);
    expect(body.id).toBe(123);
    expect(body.referenceCode).toBe('FT2026080112345');

    expect(res).toEqual({ rowsAffected: 1, status: 'success' });
  });

  it('sums guest + KYB + orphan redactions into rowsAffected', async () => {
    const { tx } = makeTx(
      3,
      [{ id: 'kyb_x', storageKey: 'kyb_doc/x/y.pdf' }],
      [{ id: 'pe_1', rawBody: SEPAY_ORPHAN_BODY }],
    );
    const res = await retentionSweeper(tx, { now: NOW });
    expect(res.rowsAffected).toBe(5); // 3 guest + 1 kyb + 1 orphan
  });

  it('parse-miss: leaves a non-JSON body unchanged but still stamps redactedAt', async () => {
    const { tx, paymentEventUpdate } = makeTx(0, [], [
      { id: 'pe_bad', rawBody: 'not-json-at-all' },
    ]);
    const res = await retentionSweeper(tx, { now: NOW });

    const call = paymentEventUpdate.mock.calls[0][0] as {
      data: { rawBody: string; redactedAt: Date };
    };
    // Body untouched, but redactedAt stamped so it is not re-claimed forever.
    expect(call.data.rawBody).toBe('not-json-at-all');
    expect(call.data.redactedAt).toBe(NOW);
    expect(res.rowsAffected).toBe(1);
  });

  it('no orphan candidates → paymentEvent.update never called', async () => {
    const { tx, paymentEventUpdate } = makeTx(0, [], []);
    await retentionSweeper(tx, { now: NOW });
    expect(paymentEventUpdate).not.toHaveBeenCalled();
  });
});
