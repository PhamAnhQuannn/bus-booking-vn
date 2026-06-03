/**
 * Issue 045: unit tests for the operator approval transition service.
 * prisma client + notificationLog repo are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OperatorStatus } from '@prisma/client';

// ---- hoisted mocks ----
const { mockTx, mockPrisma, mockCreateNotificationLog, mockWriteAdminAuditLog } = vi.hoisted(() => {
  const mockTx = {
    $queryRaw: vi.fn(),
    operator: { update: vi.fn() },
    // Issue 065: the audit row is written off the tx inside the transaction.
    adminAuditLog: { create: vi.fn() },
  };
  const mockPrisma = {
    // callback form: invoke the callback with the mock tx
    $transaction: vi.fn(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  };
  const mockCreateNotificationLog = vi.fn();
  const mockWriteAdminAuditLog = vi.fn();
  return { mockTx, mockPrisma, mockCreateNotificationLog, mockWriteAdminAuditLog };
});

vi.mock('@/lib/db/client', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/db/notificationLogRepo', () => ({
  createNotificationLog: mockCreateNotificationLog,
}));
vi.mock('@/lib/audit/adminAuditLog', () => ({
  writeAdminAuditLog: mockWriteAdminAuditLog,
}));

import {
  transitionOperatorStatus,
  isLegalOperatorTransition,
  LEGAL_OPERATOR_TRANSITIONS,
} from '../operatorStatus';
import { OperatorStatusError } from '../errors';

const OPERATOR_ID = 'op_test_123';

/** Configure the locked-row status the FOR UPDATE query returns. */
function lockStatus(status: OperatorStatus | null) {
  mockTx.$queryRaw.mockResolvedValue(status === null ? [] : [{ status }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  // default: update echoes back a representative row
  mockTx.operator.update.mockResolvedValue({
    rejectionReason: null,
    disabledAt: null,
    notificationPhone: '+8490xxxxxx7',
    contactPhone: '+8490xxxxxx8',
  });
  mockCreateNotificationLog.mockResolvedValue({ id: 'notif_1' });
  mockWriteAdminAuditLog.mockResolvedValue(undefined);
});

describe('LEGAL_OPERATOR_TRANSITIONS map', () => {
  it('declares every OperatorStatus key (no silent holes)', () => {
    const keys = Object.keys(LEGAL_OPERATOR_TRANSITIONS).sort();
    expect(keys).toEqual(
      ['APPROVED', 'PENDING_REVIEW', 'REJECTED', 'SUSPENDED', 'UNDER_REVIEW'].sort()
    );
  });

  it('isLegalOperatorTransition matches the spec edges', () => {
    expect(isLegalOperatorTransition('PENDING_REVIEW', 'UNDER_REVIEW')).toBe(true);
    expect(isLegalOperatorTransition('UNDER_REVIEW', 'APPROVED')).toBe(true);
    expect(isLegalOperatorTransition('UNDER_REVIEW', 'REJECTED')).toBe(true);
    expect(isLegalOperatorTransition('REJECTED', 'PENDING_REVIEW')).toBe(true);
    expect(isLegalOperatorTransition('APPROVED', 'SUSPENDED')).toBe(true);
    expect(isLegalOperatorTransition('SUSPENDED', 'APPROVED')).toBe(true);
    // illegal samples
    expect(isLegalOperatorTransition('APPROVED', 'PENDING_REVIEW')).toBe(false);
    expect(isLegalOperatorTransition('PENDING_REVIEW', 'APPROVED')).toBe(false);
    expect(isLegalOperatorTransition('APPROVED', 'APPROVED')).toBe(false);
  });
});

describe('transitionOperatorStatus — legal edges', () => {
  const legalEdges: [OperatorStatus, OperatorStatus][] = [
    ['PENDING_REVIEW', 'UNDER_REVIEW'],
    ['UNDER_REVIEW', 'APPROVED'],
    ['UNDER_REVIEW', 'REJECTED'],
    ['REJECTED', 'PENDING_REVIEW'],
    ['APPROVED', 'SUSPENDED'],
    ['SUSPENDED', 'APPROVED'],
  ];

  for (const [from, to] of legalEdges) {
    it(`${from} → ${to} succeeds and enqueues exactly one NotificationLog`, async () => {
      lockStatus(from);
      const res = await transitionOperatorStatus({ operatorId: OPERATOR_ID, to });
      expect(res.from).toBe(from);
      expect(res.to).toBe(to);
      expect(mockTx.operator.update).toHaveBeenCalledTimes(1);
      expect(mockCreateNotificationLog).toHaveBeenCalledTimes(1);
      expect(mockCreateNotificationLog.mock.calls[0][0]).toMatchObject({
        status: 'pending',
      });
    });
  }
});

describe('transitionOperatorStatus — disabledAt sync', () => {
  it('→ SUSPENDED sets disabledAt to a Date', async () => {
    lockStatus('APPROVED');
    await transitionOperatorStatus({ operatorId: OPERATOR_ID, to: 'SUSPENDED' });
    const data = mockTx.operator.update.mock.calls[0][0].data;
    expect(data.status).toBe('SUSPENDED');
    expect(data.disabledAt).toBeInstanceOf(Date);
  });

  it('→ APPROVED clears disabledAt (null)', async () => {
    lockStatus('SUSPENDED');
    await transitionOperatorStatus({ operatorId: OPERATOR_ID, to: 'APPROVED' });
    const data = mockTx.operator.update.mock.calls[0][0].data;
    expect(data.status).toBe('APPROVED');
    expect(data.disabledAt).toBeNull();
  });

  it('→ REJECTED records the reason', async () => {
    lockStatus('UNDER_REVIEW');
    await transitionOperatorStatus({
      operatorId: OPERATOR_ID,
      to: 'REJECTED',
      reason: 'missing payout docs',
    });
    const data = mockTx.operator.update.mock.calls[0][0].data;
    expect(data.rejectionReason).toBe('missing payout docs');
  });

  it('→ PENDING_REVIEW (resubmit) clears the rejection reason', async () => {
    lockStatus('REJECTED');
    await transitionOperatorStatus({ operatorId: OPERATOR_ID, to: 'PENDING_REVIEW' });
    const data = mockTx.operator.update.mock.calls[0][0].data;
    expect(data.rejectionReason).toBeNull();
  });
});

describe('transitionOperatorStatus — illegal edges & missing operator', () => {
  it('rejects APPROVED → PENDING_REVIEW (illegal)', async () => {
    lockStatus('APPROVED');
    await expect(
      transitionOperatorStatus({ operatorId: OPERATOR_ID, to: 'PENDING_REVIEW' })
    ).rejects.toMatchObject({
      name: 'OperatorStatusError',
      code: 'illegal_transition',
    });
    expect(mockTx.operator.update).not.toHaveBeenCalled();
    expect(mockCreateNotificationLog).not.toHaveBeenCalled();
  });

  it('rejects PENDING_REVIEW → APPROVED (illegal, must go via UNDER_REVIEW)', async () => {
    lockStatus('PENDING_REVIEW');
    await expect(
      transitionOperatorStatus({ operatorId: OPERATOR_ID, to: 'APPROVED' })
    ).rejects.toBeInstanceOf(OperatorStatusError);
    expect(mockTx.operator.update).not.toHaveBeenCalled();
  });

  it('rejects when the operator does not exist', async () => {
    lockStatus(null);
    await expect(
      transitionOperatorStatus({ operatorId: 'nope', to: 'UNDER_REVIEW' })
    ).rejects.toMatchObject({ code: 'operator_not_found' });
  });
});

describe('transitionOperatorStatus — audit (Issue 065)', () => {
  it('writes an AdminAuditLog row INSIDE the transaction when actor is present', async () => {
    lockStatus('UNDER_REVIEW');
    await transitionOperatorStatus({
      operatorId: OPERATOR_ID,
      to: 'APPROVED',
      actor: 'admin:super-1',
    });

    expect(mockWriteAdminAuditLog).toHaveBeenCalledTimes(1);
    // Called with the tx handle (not the singleton) so it commits with the update.
    expect(mockWriteAdminAuditLog).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        actor: 'admin:super-1',
        action: 'operator-status:APPROVED',
        target: OPERATOR_ID,
      })
    );
    const args = mockWriteAdminAuditLog.mock.calls[0][1];
    expect(JSON.parse(args.argsRedacted)).toMatchObject({ from: 'UNDER_REVIEW', to: 'APPROVED' });
  });

  it('includes the reason in the audit args for a REJECTED transition', async () => {
    lockStatus('UNDER_REVIEW');
    await transitionOperatorStatus({
      operatorId: OPERATOR_ID,
      to: 'REJECTED',
      reason: 'missing payout docs',
      actor: 'admin:super-1',
    });
    const args = mockWriteAdminAuditLog.mock.calls[0][1];
    expect(JSON.parse(args.argsRedacted)).toMatchObject({
      from: 'UNDER_REVIEW',
      to: 'REJECTED',
      reason: 'missing payout docs',
    });
  });

  it('does NOT write an audit row when actor is absent (CLI/system caller)', async () => {
    lockStatus('PENDING_REVIEW');
    await transitionOperatorStatus({ operatorId: OPERATOR_ID, to: 'UNDER_REVIEW' });
    expect(mockWriteAdminAuditLog).not.toHaveBeenCalled();
  });
});
