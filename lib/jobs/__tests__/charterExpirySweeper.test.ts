/**
 * Issue 086: unit tests for the charter-expiry sweeper core.
 *
 * The DB client, the transition service, and the notification repo are mocked.
 * The lock `tx` (the JobCore's first arg) is a stub whose $queryRaw returns the
 * staged candidate rows. We assert the sweeper:
 *   - claims stale ASSIGNED_DIRECT + expired PUBLISHED via two FOR UPDATE SKIP
 *     LOCKED selects,
 *   - calls the right transition(s) per class (single-step vs two-step),
 *   - enqueues the charterReturnedToReview sms+email per rerouted lead,
 *   - tolerates a concurrent illegal_transition (skips that row, continues),
 *   - returns rowsAffected = total rerouted.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- hoisted mocks ----
const { mockPrisma, mockTransition, mockCreateNotificationLog, CharterErrorMock } = vi.hoisted(() => {
  class CharterErrorMock extends Error {
    code: string;
    constructor(code: string, detail?: string) {
      super(detail ? `${code}: ${detail}` : code);
      this.name = 'CharterError';
      this.code = code;
    }
  }
  return {
    mockPrisma: {},
    mockTransition: vi.fn(),
    mockCreateNotificationLog: vi.fn(),
    CharterErrorMock,
  };
});

vi.mock('@/lib/db/client', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/charter/charterStatus', () => ({ transitionCharterRequest: mockTransition }));
vi.mock('@/lib/charter/errors', () => ({ CharterError: CharterErrorMock }));
vi.mock('@/lib/db/notificationLogRepo', () => ({ createNotificationLog: mockCreateNotificationLog }));
// Prisma.sql is used to build the tagged query; a passthrough is enough for the
// stub tx, which ignores the SQL and returns staged rows by call order.
vi.mock('@prisma/client', () => ({
  Prisma: { sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ strings, vals }) },
}));

import { charterExpirySweeper } from '../charterExpirySweeper';

/** Build a lock-tx stub whose $queryRaw returns assignedRows then publishedRows. */
function makeTx(assignedRows: unknown[], publishedRows: unknown[]) {
  const queryRaw = vi
    .fn()
    .mockResolvedValueOnce(assignedRows)
    .mockResolvedValueOnce(publishedRows);
  return { $queryRaw: queryRaw } as never;
}

const assignedRow = {
  id: 'ch_assigned_1',
  ref: 'CH-2026-AAA111',
  contactPhone: '+8490xxxxxx1',
  contactEmail: 'a@charter.dev',
};
const publishedRow = {
  id: 'ch_pub_1',
  ref: 'CH-2026-BBB222',
  contactPhone: '+8490xxxxxx2',
  contactEmail: 'b@charter.dev',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTransition.mockResolvedValue({ ok: true });
  mockCreateNotificationLog.mockResolvedValue(undefined);
});

describe('charterExpirySweeper', () => {
  it('issues two FOR UPDATE SKIP LOCKED claim selects (assigned + published)', async () => {
    const tx = makeTx([], []);
    await charterExpirySweeper(tx);
    expect((tx as unknown as { $queryRaw: ReturnType<typeof vi.fn> }).$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('reroutes a stale ASSIGNED_DIRECT single-step → ADMIN_REVIEW + notifies', async () => {
    const tx = makeTx([assignedRow], []);
    const res = await charterExpirySweeper(tx);

    expect(mockTransition).toHaveBeenCalledTimes(1);
    expect(mockTransition).toHaveBeenCalledWith(mockPrisma, {
      charterId: 'ch_assigned_1',
      to: 'ADMIN_REVIEW',
      actor: 'cron:charter-sweep',
    });
    // sms + email returned-to-review
    expect(mockCreateNotificationLog).toHaveBeenCalledTimes(2);
    const channels = mockCreateNotificationLog.mock.calls.map((c) => c[0].channel).sort();
    expect(channels).toEqual(['email', 'sms']);
    for (const call of mockCreateNotificationLog.mock.calls) {
      expect(call[0].template).toBe('charterReturnedToReview');
      expect(call[0].status).toBe('pending');
      expect(JSON.parse(call[0].payload)).toEqual({ ref: 'CH-2026-AAA111' });
    }
    expect(res).toEqual({ rowsAffected: 1, status: 'success' });
  });

  it('reroutes an expired PUBLISHED two-step → EXPIRED → ADMIN_REVIEW + notifies', async () => {
    const tx = makeTx([], [publishedRow]);
    const res = await charterExpirySweeper(tx);

    expect(mockTransition).toHaveBeenCalledTimes(2);
    expect(mockTransition).toHaveBeenNthCalledWith(1, mockPrisma, {
      charterId: 'ch_pub_1',
      to: 'EXPIRED',
      actor: 'cron:charter-sweep',
    });
    expect(mockTransition).toHaveBeenNthCalledWith(2, mockPrisma, {
      charterId: 'ch_pub_1',
      to: 'ADMIN_REVIEW',
      actor: 'cron:charter-sweep',
    });
    expect(mockCreateNotificationLog).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ rowsAffected: 1, status: 'success' });
  });

  it('reroutes both classes in one run (rowsAffected = 2)', async () => {
    const tx = makeTx([assignedRow], [publishedRow]);
    const res = await charterExpirySweeper(tx);
    // 1 (assigned) + 2 (published two-step) = 3 transition calls
    expect(mockTransition).toHaveBeenCalledTimes(3);
    expect(res.rowsAffected).toBe(2);
    expect(mockCreateNotificationLog).toHaveBeenCalledTimes(4);
  });

  it('tolerates a concurrent illegal_transition on a stale ASSIGNED_DIRECT (skips, continues)', async () => {
    const otherAssigned = { ...assignedRow, id: 'ch_assigned_2', ref: 'CH-2026-CCC333' };
    const tx = makeTx([assignedRow, otherAssigned], []);
    // First row lost the race (operator accepted just in time) → illegal; second OK.
    mockTransition
      .mockRejectedValueOnce(new CharterErrorMock('illegal_transition', 'ACCEPTED -> ADMIN_REVIEW'))
      .mockResolvedValueOnce({ ok: true });

    const res = await charterExpirySweeper(tx);

    expect(mockTransition).toHaveBeenCalledTimes(2);
    // Only the second row rerouted + notified (the first was skipped as illegal).
    expect(res.rowsAffected).toBe(1);
    expect(mockCreateNotificationLog).toHaveBeenCalledTimes(2);
    const notifiedRefs = mockCreateNotificationLog.mock.calls.map((c) => JSON.parse(c[0].payload).ref);
    expect(new Set(notifiedRefs)).toEqual(new Set(['CH-2026-CCC333']));
  });

  it('skips a PUBLISHED row whose claim was won concurrently (EXPIRED step illegal)', async () => {
    const tx = makeTx([], [publishedRow]);
    mockTransition.mockRejectedValueOnce(
      new CharterErrorMock('illegal_transition', 'ACCEPTED -> EXPIRED')
    );
    const res = await charterExpirySweeper(tx);
    // Only the EXPIRED attempt happened; the ADMIN_REVIEW step never ran.
    expect(mockTransition).toHaveBeenCalledTimes(1);
    expect(res.rowsAffected).toBe(0);
    expect(mockCreateNotificationLog).not.toHaveBeenCalled();
  });

  it('rethrows a non-illegal_transition error (does not swallow real failures)', async () => {
    const tx = makeTx([assignedRow], []);
    mockTransition.mockRejectedValueOnce(new Error('db down'));
    await expect(charterExpirySweeper(tx)).rejects.toThrow('db down');
  });
});
