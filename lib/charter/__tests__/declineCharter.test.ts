/**
 * Issue 083: unit tests for declineCharter.
 *
 * A decline is TWO transitions: ASSIGNED_DIRECT → DECLINED (the DECLINED
 * side-effect clears assigneeOperatorId — Issue 081) then DECLINED → ADMIN_REVIEW
 * (re-route the freed lead). transitionCharterRequest is mocked; we assert BOTH
 * transitions run, in order, with the operator actor, and the final result is
 * ADMIN_REVIEW. The assignee-clear itself is the DECLINED branch of
 * transitionCharterRequest (covered by charterStatus.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTransition, mockCreateNotificationLog } = vi.hoisted(() => ({
  mockTransition: vi.fn(),
  mockCreateNotificationLog: vi.fn(),
}));

vi.mock('../charterStatus', () => ({ transitionCharterRequest: mockTransition }));
vi.mock('@/lib/core/db/notificationLogRepo', () => ({ createNotificationLog: mockCreateNotificationLog }));

import { declineCharter } from '../declineCharter';

const CHARTER_ID = 'ch_1';
const ACTOR = 'operator:op-org-A';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = {} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockTransition.mockResolvedValue({ ok: true });
  mockCreateNotificationLog.mockResolvedValue(undefined);
});

describe('declineCharter', () => {
  it('runs DECLINED then ADMIN_REVIEW in order, with the operator actor', async () => {
    const result = await declineCharter(prisma, { charterId: CHARTER_ID, actor: ACTOR, opsEmail: 'ops@test.com' });

    expect(mockTransition).toHaveBeenCalledTimes(2);
    expect(mockTransition).toHaveBeenNthCalledWith(1, prisma, {
      charterId: CHARTER_ID,
      to: 'DECLINED',
      actor: ACTOR,
    });
    expect(mockTransition).toHaveBeenNthCalledWith(2, prisma, {
      charterId: CHARTER_ID,
      to: 'ADMIN_REVIEW',
      actor: ACTOR,
    });
    expect(result).toEqual({ ok: true, charterId: CHARTER_ID, to: 'ADMIN_REVIEW' });
  });

  it('enqueues a best-effort ops decline notification with the reason', async () => {
    await declineCharter(prisma, { charterId: CHARTER_ID, actor: ACTOR, reason: 'no bus', opsEmail: 'ops@test.com' });
    expect(mockCreateNotificationLog).toHaveBeenCalledTimes(1);
    const arg = mockCreateNotificationLog.mock.calls[0][0];
    expect(arg.template).toBe('charterDeclined');
    expect(JSON.parse(arg.payload)).toMatchObject({ charterId: CHARTER_ID, reason: 'no bus' });
  });

  it('propagates an illegal_transition from the first transition (does not run the second)', async () => {
    const err = new Error('illegal_transition');
    mockTransition.mockRejectedValueOnce(err);
    await expect(declineCharter(prisma, { charterId: CHARTER_ID, actor: ACTOR, opsEmail: 'ops@test.com' })).rejects.toThrow(err);
    expect(mockTransition).toHaveBeenCalledTimes(1);
  });

  it('does not fail the decline if the ops notification throws', async () => {
    mockCreateNotificationLog.mockRejectedValueOnce(new Error('log down'));
    const result = await declineCharter(prisma, { charterId: CHARTER_ID, actor: ACTOR, opsEmail: 'ops@test.com' });
    expect(result.to).toBe('ADMIN_REVIEW');
  });
});
