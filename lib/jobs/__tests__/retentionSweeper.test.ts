/**
 * Issue 090 + PDPL hardening (2026-09): unit tests for the retention sweeper core.
 *
 * The DB client, the storage layer (deleteObject), and the retention-policy
 * constants are mocked. The lock `tx` (the JobCore's first arg) is a stub whose
 * $executeRaw / $queryRaw return staged values BY CALL ORDER, because several arms
 * share them:
 *   $executeRaw order: 1=guest scrub, 2..=planner-delete batches, then notif, then charter.
 *   $queryRaw   order: 1=KYB claim, 2=orphan claim, 3=ticket-PDF purge claim.
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
  PLANNER_CHAT_RETENTION_DAYS: 90,
  NOTIFICATION_PII_RETENTION_DAYS: 180,
  CHARTER_CONTACT_RETENTION_DAYS: 365,
}));
vi.mock('@/lib/charter', () => ({
  TERMINAL_CHARTER_STATUSES: new Set(['REJECTED', 'COMPLETED', 'CANCELLED']),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
// Prisma.sql / Prisma.join passthrough — the stub tx ignores the SQL and returns
// staged values by call order.
vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@prisma/client')>();
  return {
    ...actual,
    Prisma: {
      ...actual.Prisma,
      sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ strings, vals }),
      join: (parts: unknown[]) => ({ parts }),
    },
  };
});

import { retentionSweeper } from '../retentionSweeper';

interface MakeTxOpts {
  /** Row counts each planner-delete batch resolves to, in order. Loop stops when a
   *  batch < 200 (PLANNER_DELETE_LIMIT). Default [0] = one empty batch, stops. */
  plannerBatches?: number[];
  /** Ticket-PDF purge candidate rows (3rd $queryRaw). */
  pdfRows?: Array<{ id: string; ticketPdfKey: string }>;
  /** Affected-row count the NotificationLog scrub $executeRaw resolves to. */
  notifCount?: number;
  /** Affected-row count the CharterRequest scrub $executeRaw resolves to. */
  charterCount?: number;
}

/**
 * Build a lock-tx stub.
 * @param guestCount  the affected-row count the guest-scrub $executeRaw resolves to
 * @param kybRows     the KYB candidate rows the 1st $queryRaw resolves to
 * @param orphanRows  the orphan rows the 2nd $queryRaw resolves to
 * @param opts        planner/pdf/notif/charter staging for the PDPL arms
 */
function makeTx(
  guestCount: number,
  kybRows: unknown[],
  orphanRows: unknown[] = [],
  opts: MakeTxOpts = {},
) {
  const { plannerBatches = [0], pdfRows = [], notifCount = 0, charterCount = 0 } = opts;
  const kybUpdate = vi.fn().mockResolvedValue({});
  const paymentEventUpdate = vi.fn().mockResolvedValue({});
  const bookingUpdate = vi.fn().mockResolvedValue({});

  // $executeRaw staged by order: guest, planner batches…, notif, charter.
  const execRaw = vi.fn();
  execRaw.mockResolvedValueOnce(guestCount);
  for (const b of plannerBatches) execRaw.mockResolvedValueOnce(b);
  execRaw.mockResolvedValueOnce(notifCount);
  execRaw.mockResolvedValueOnce(charterCount);

  // $queryRaw staged by order: KYB claim, orphan claim, PDF purge claim.
  const queryRaw = vi
    .fn()
    .mockResolvedValueOnce(kybRows)
    .mockResolvedValueOnce(orphanRows)
    .mockResolvedValueOnce(pdfRows);

  return {
    tx: {
      $executeRaw: execRaw,
      $queryRaw: queryRaw,
      kybDocument: { update: kybUpdate },
      paymentEvent: { update: paymentEventUpdate },
      booking: { update: bookingUpdate },
    } as never,
    kybUpdate,
    paymentEventUpdate,
    bookingUpdate,
    execRaw,
  };
}

const NOW = new Date('2026-06-03T03:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteObject.mockResolvedValue(undefined);
});

describe('retentionSweeper', () => {
  it('runs the guest-scrub UPDATE and counts its affected rows', async () => {
    const { tx, execRaw } = makeTx(4, []);
    const res = await retentionSweeper(tx, { now: NOW });

    // $executeRaw now fires for guest + 1 (empty) planner batch + notif + charter = 4.
    expect(execRaw).toHaveBeenCalledTimes(4);
    expect(res).toEqual({ rowsAffected: 4, status: 'success' });
  });

  it('purges each expired KYB doc: deleteObject + stamps purgedAt', async () => {
    const kybRows = [
      { id: 'kyb_1', storageKey: 'kyb_doc/aaa/license.pdf' },
      { id: 'kyb_2', storageKey: 'kyb_doc/bbb/identity.pdf' },
    ];
    const { tx, kybUpdate } = makeTx(0, kybRows);

    const res = await retentionSweeper(tx, { now: NOW });

    expect(mockDeleteObject).toHaveBeenCalledTimes(2);
    expect(mockDeleteObject).toHaveBeenNthCalledWith(1, mockPrisma, 'kyb_doc/aaa/license.pdf');
    expect(mockDeleteObject).toHaveBeenNthCalledWith(2, mockPrisma, 'kyb_doc/bbb/identity.pdf');

    expect(kybUpdate).toHaveBeenCalledTimes(2);
    expect(kybUpdate).toHaveBeenNthCalledWith(1, { where: { id: 'kyb_1' }, data: { purgedAt: NOW } });
    expect(kybUpdate).toHaveBeenNthCalledWith(2, { where: { id: 'kyb_2' }, data: { purgedAt: NOW } });

    expect(res).toEqual({ rowsAffected: 2, status: 'success' });
  });

  it('is a no-op (0) when nothing is past any window', async () => {
    const { tx, kybUpdate, bookingUpdate } = makeTx(0, []);
    const res = await retentionSweeper(tx, { now: NOW });
    expect(mockDeleteObject).not.toHaveBeenCalled();
    expect(kybUpdate).not.toHaveBeenCalled();
    expect(bookingUpdate).not.toHaveBeenCalled();
    expect(res).toEqual({ rowsAffected: 0, status: 'success' });
  });

  it('does NOT stamp purgedAt when deleteObject throws (loud, bytes-first)', async () => {
    const { tx, kybUpdate } = makeTx(0, [{ id: 'kyb_z', storageKey: 'kyb_doc/z/z.pdf' }]);
    mockDeleteObject.mockRejectedValueOnce(new Error('s3_delete_failed'));
    await expect(retentionSweeper(tx, { now: NOW })).rejects.toThrow('s3_delete_failed');
    expect(kybUpdate).not.toHaveBeenCalled();
  });

  // --- #332: orphan PaymentEvent PII redaction arm ---------------------------------
  const SEPAY_ORPHAN_BODY = JSON.stringify({
    id: 123,
    gateway: 'VCB',
    transactionDate: '2026-08-01 10:00:00',
    accountNumber: '0123456789',
    subAccount: '9988',
    code: null,
    content: 'NGUYEN VAN A chuyen tien',
    transferType: 'in',
    description: 'NGUYEN VAN A chuyen khoan',
    transferAmount: 200000,
    referenceCode: 'FT2026080112345',
    accumulated: 5000000,
  });

  it('strips payer PII from an expired orphan rawBody, keeps evidence, stamps redactedAt', async () => {
    const { tx, paymentEventUpdate } = makeTx(0, [], [{ id: 'pe_orphan_1', rawBody: SEPAY_ORPHAN_BODY }]);
    const res = await retentionSweeper(tx, { now: NOW });

    expect(paymentEventUpdate).toHaveBeenCalledTimes(1);
    const call = paymentEventUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: { rawBody: string; redactedAt: Date };
    };
    expect(call.where).toEqual({ id: 'pe_orphan_1' });
    expect(call.data.redactedAt).toBe(NOW);

    const body = JSON.parse(call.data.rawBody);
    expect(body.description).toBeNull();
    expect(body.content).toBeNull();
    expect(body.accumulated).toBeNull();
    expect(body.accountNumber).toBe('0123456789');
    expect(body.subAccount).toBe('9988');
    expect(body.transferAmount).toBe(200000);
    expect(body.id).toBe(123);
    expect(body.referenceCode).toBe('FT2026080112345');

    expect(res).toEqual({ rowsAffected: 1, status: 'success' });
  });

  it('parse-miss: leaves a non-JSON body unchanged but still stamps redactedAt', async () => {
    const { tx, paymentEventUpdate } = makeTx(0, [], [{ id: 'pe_bad', rawBody: 'not-json-at-all' }]);
    const res = await retentionSweeper(tx, { now: NOW });
    const call = paymentEventUpdate.mock.calls[0][0] as { data: { rawBody: string; redactedAt: Date } };
    expect(call.data.rawBody).toBe('not-json-at-all');
    expect(call.data.redactedAt).toBe(NOW);
    expect(res.rowsAffected).toBe(1);
  });

  // --- W2: planner conversation retention (bounded batch DELETE) --------------------
  it('deletes stale planner conversations and counts them', async () => {
    const { tx } = makeTx(0, [], [], { plannerBatches: [7] });
    const res = await retentionSweeper(tx, { now: NOW });
    expect(res.rowsAffected).toBe(7);
  });

  it('loops planner deletes until a batch is under the limit', async () => {
    // First batch full (200) → continue; second (50) < 200 → stop. 250 total.
    const { tx, execRaw } = makeTx(0, [], [], { plannerBatches: [200, 50] });
    const res = await retentionSweeper(tx, { now: NOW });
    expect(res.rowsAffected).toBe(250);
    // guest + 2 planner batches + notif + charter = 5 $executeRaw calls.
    expect(execRaw).toHaveBeenCalledTimes(5);
  });

  // --- W3: ticket-PDF purge --------------------------------------------------------
  it('purges the ticket PDF of a scrubbed booking: deleteObject + NULLs the key', async () => {
    const { tx, bookingUpdate } = makeTx(0, [], [], {
      pdfRows: [{ id: 'bk_1', ticketPdfKey: 'ticket_pdf/BB-1.pdf' }],
    });
    const res = await retentionSweeper(tx, { now: NOW });

    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
    expect(mockDeleteObject).toHaveBeenCalledWith(mockPrisma, 'ticket_pdf/BB-1.pdf');
    expect(bookingUpdate).toHaveBeenCalledWith({
      where: { id: 'bk_1' },
      data: { ticketPdfKey: null, ticketPdfGeneratedAt: null },
    });
    expect(res.rowsAffected).toBe(1);
  });

  it('does NOT NULL the PDF key when the storage delete throws', async () => {
    const { tx, bookingUpdate } = makeTx(0, [], [], {
      pdfRows: [{ id: 'bk_z', ticketPdfKey: 'ticket_pdf/BB-Z.pdf' }],
    });
    mockDeleteObject.mockRejectedValueOnce(new Error('s3_delete_failed'));
    await expect(retentionSweeper(tx, { now: NOW })).rejects.toThrow('s3_delete_failed');
    expect(bookingUpdate).not.toHaveBeenCalled();
  });

  // --- W4 / W6: notification + charter scrub counts --------------------------------
  it('counts NotificationLog and CharterRequest scrubs into rowsAffected', async () => {
    const { tx } = makeTx(0, [], [], { notifCount: 5, charterCount: 2 });
    const res = await retentionSweeper(tx, { now: NOW });
    expect(res.rowsAffected).toBe(7);
  });

  it('sums every arm into rowsAffected', async () => {
    const { tx } = makeTx(3, [{ id: 'kyb_x', storageKey: 'kyb_doc/x/y.pdf' }], [
      { id: 'pe_1', rawBody: SEPAY_ORPHAN_BODY },
    ], { plannerBatches: [4], pdfRows: [{ id: 'bk_1', ticketPdfKey: 'ticket_pdf/BB-1.pdf' }], notifCount: 6, charterCount: 2 });
    const res = await retentionSweeper(tx, { now: NOW });
    // 3 guest + 1 kyb + 1 orphan + 4 planner + 1 pdf + 6 notif + 2 charter = 18.
    expect(res.rowsAffected).toBe(18);
  });
});
