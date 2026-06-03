/**
 * Issue 081: unit tests for the charter-request transition service.
 * The prisma client + tx are mocked (passed by parameter, no app singleton).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CharterStatus } from '@prisma/client';

// ---- hoisted mocks ----
const { mockTx, mockPrisma, mockWriteAdminAuditLog } = vi.hoisted(() => {
  const mockTx = {
    $queryRaw: vi.fn(),
    charterRequest: { update: vi.fn() },
    adminAuditLog: { create: vi.fn() },
  };
  const mockPrisma = {
    // callback form: invoke the callback with the mock tx
    $transaction: vi.fn(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    adminAuditLog: { create: vi.fn() },
  };
  const mockWriteAdminAuditLog = vi.fn();
  return { mockTx, mockPrisma, mockWriteAdminAuditLog };
});

vi.mock('@/lib/audit/adminAuditLog', () => ({
  writeAdminAuditLog: mockWriteAdminAuditLog,
}));

import {
  transitionCharterRequest,
  isLegalCharterTransition,
  LEGAL_CHARTER_TRANSITIONS,
} from '../charterStatus';
import { CharterError } from '../errors';

const CHARTER_ID = 'ch_test_123';

/** Configure the locked-row status the FOR UPDATE query returns. */
function lockStatus(status: CharterStatus | null) {
  mockTx.$queryRaw.mockResolvedValue(status === null ? [] : [{ status }]);
}

// Helper to invoke with the mock client typed loosely (the mock satisfies the
// runtime surface; we only care about the call shapes).
function transition(input: Parameters<typeof transitionCharterRequest>[1]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return transitionCharterRequest(mockPrisma as any, input);
}

beforeEach(() => {
  vi.clearAllMocks();
  // default: update echoes back a representative row
  mockTx.charterRequest.update.mockResolvedValue({
    status: 'ADMIN_REVIEW',
    assigneeOperatorId: null,
  });
  mockWriteAdminAuditLog.mockResolvedValue(undefined);
});

describe('LEGAL_CHARTER_TRANSITIONS map', () => {
  it('declares every CharterStatus key (no silent holes)', () => {
    const keys = Object.keys(LEGAL_CHARTER_TRANSITIONS).sort();
    expect(keys).toEqual(
      [
        'SUBMITTED',
        'ADMIN_REVIEW',
        'ASSIGNED_DIRECT',
        'PUBLISHED',
        'ACCEPTED',
        'DECLINED',
        'REJECTED',
        'EXPIRED',
        'COMPLETED',
        'CANCELLED',
      ].sort()
    );
  });

  it('REJECTED / COMPLETED / CANCELLED are terminal (empty edge lists)', () => {
    expect(LEGAL_CHARTER_TRANSITIONS.REJECTED).toEqual([]);
    expect(LEGAL_CHARTER_TRANSITIONS.COMPLETED).toEqual([]);
    expect(LEGAL_CHARTER_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('isLegalCharterTransition matches the spec edges', () => {
    expect(isLegalCharterTransition('SUBMITTED', 'ADMIN_REVIEW')).toBe(true);
    expect(isLegalCharterTransition('ADMIN_REVIEW', 'ASSIGNED_DIRECT')).toBe(true);
    expect(isLegalCharterTransition('ADMIN_REVIEW', 'PUBLISHED')).toBe(true);
    expect(isLegalCharterTransition('ADMIN_REVIEW', 'REJECTED')).toBe(true);
    expect(isLegalCharterTransition('ASSIGNED_DIRECT', 'ACCEPTED')).toBe(true);
    expect(isLegalCharterTransition('ASSIGNED_DIRECT', 'DECLINED')).toBe(true);
    expect(isLegalCharterTransition('PUBLISHED', 'ACCEPTED')).toBe(true);
    expect(isLegalCharterTransition('PUBLISHED', 'EXPIRED')).toBe(true);
    expect(isLegalCharterTransition('DECLINED', 'ADMIN_REVIEW')).toBe(true);
    expect(isLegalCharterTransition('EXPIRED', 'ADMIN_REVIEW')).toBe(true);
    expect(isLegalCharterTransition('ACCEPTED', 'COMPLETED')).toBe(true);
    expect(isLegalCharterTransition('ACCEPTED', 'CANCELLED')).toBe(true);
    // illegal samples
    expect(isLegalCharterTransition('SUBMITTED', 'ACCEPTED')).toBe(false);
    expect(isLegalCharterTransition('REJECTED', 'ADMIN_REVIEW')).toBe(false);
    expect(isLegalCharterTransition('COMPLETED', 'ACCEPTED')).toBe(false);
  });
});

describe('transitionCharterRequest — every legal edge succeeds', () => {
  const legalEdges: [CharterStatus, CharterStatus][] = [
    ['SUBMITTED', 'ADMIN_REVIEW'],
    ['ADMIN_REVIEW', 'ASSIGNED_DIRECT'],
    ['ADMIN_REVIEW', 'PUBLISHED'],
    ['ADMIN_REVIEW', 'REJECTED'],
    ['ASSIGNED_DIRECT', 'ACCEPTED'],
    ['ASSIGNED_DIRECT', 'DECLINED'],
    ['PUBLISHED', 'ACCEPTED'],
    ['PUBLISHED', 'EXPIRED'],
    ['DECLINED', 'ADMIN_REVIEW'],
    ['EXPIRED', 'ADMIN_REVIEW'],
    ['ACCEPTED', 'COMPLETED'],
    ['ACCEPTED', 'CANCELLED'],
  ];

  for (const [from, to] of legalEdges) {
    it(`${from} → ${to} returns a discriminated ok result`, async () => {
      lockStatus(from);
      const res = await transition({ charterId: CHARTER_ID, to });
      expect(res.ok).toBe(true);
      expect(res.from).toBe(from);
      expect(res.to).toBe(to);
      expect(res.charterId).toBe(CHARTER_ID);
      expect(mockTx.charterRequest.update).toHaveBeenCalledTimes(1);
      // the update always writes the target status
      expect(mockTx.charterRequest.update.mock.calls[0][0].data.status).toBe(to);
    });
  }
});

describe('transitionCharterRequest — FOR UPDATE lock shape', () => {
  it('issues a SELECT … FOR UPDATE on CharterRequest before the update', async () => {
    lockStatus('SUBMITTED');
    await transition({ charterId: CHARTER_ID, to: 'ADMIN_REVIEW' });
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
    // tagged-template call: first arg is the strings array.
    const strings = mockTx.$queryRaw.mock.calls[0][0] as unknown as string[];
    const sql = strings.join('?');
    expect(sql).toContain('"CharterRequest"');
    expect(sql).toContain('FOR UPDATE');
    // the charterId is threaded as the interpolated value
    expect(mockTx.$queryRaw.mock.calls[0][1]).toBe(CHARTER_ID);
  });
});

describe('transitionCharterRequest — side-effect fields per target', () => {
  it('→ ASSIGNED_DIRECT sets assigneeOperatorId + acceptByAt', async () => {
    lockStatus('ADMIN_REVIEW');
    const acceptBy = new Date('2026-06-10T00:00:00Z');
    await transition({
      charterId: CHARTER_ID,
      to: 'ASSIGNED_DIRECT',
      assigneeOperatorId: 'op_42',
      acceptByAt: acceptBy,
    });
    const data = mockTx.charterRequest.update.mock.calls[0][0].data;
    expect(data.status).toBe('ASSIGNED_DIRECT');
    expect(data.assigneeOperatorId).toBe('op_42');
    expect(data.acceptByAt).toBe(acceptBy);
  });

  it('→ PUBLISHED sets publishedAt (Date) + claimByAt', async () => {
    lockStatus('ADMIN_REVIEW');
    const claimBy = new Date('2026-06-08T00:00:00Z');
    await transition({ charterId: CHARTER_ID, to: 'PUBLISHED', claimByAt: claimBy });
    const data = mockTx.charterRequest.update.mock.calls[0][0].data;
    expect(data.status).toBe('PUBLISHED');
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(data.claimByAt).toBe(claimBy);
  });

  it('→ REJECTED records the rejection reason', async () => {
    lockStatus('ADMIN_REVIEW');
    await transition({
      charterId: CHARTER_ID,
      to: 'REJECTED',
      rejectionReason: 'no operator covers this route',
    });
    const data = mockTx.charterRequest.update.mock.calls[0][0].data;
    expect(data.status).toBe('REJECTED');
    expect(data.rejectionReason).toBe('no operator covers this route');
  });

  it('→ DECLINED clears assigneeOperatorId (frees the lead)', async () => {
    lockStatus('ASSIGNED_DIRECT');
    await transition({ charterId: CHARTER_ID, to: 'DECLINED' });
    const data = mockTx.charterRequest.update.mock.calls[0][0].data;
    expect(data.status).toBe('DECLINED');
    expect(data.assigneeOperatorId).toBeNull();
  });

  it('→ EXPIRED clears assigneeOperatorId (frees the lead)', async () => {
    lockStatus('PUBLISHED');
    await transition({ charterId: CHARTER_ID, to: 'EXPIRED' });
    const data = mockTx.charterRequest.update.mock.calls[0][0].data;
    expect(data.status).toBe('EXPIRED');
    expect(data.assigneeOperatorId).toBeNull();
  });

  it('→ ADMIN_REVIEW writes status only (no side-effect columns)', async () => {
    lockStatus('SUBMITTED');
    await transition({ charterId: CHARTER_ID, to: 'ADMIN_REVIEW' });
    const data = mockTx.charterRequest.update.mock.calls[0][0].data;
    expect(Object.keys(data)).toEqual(['status']);
  });
});

describe('transitionCharterRequest — illegal edges & missing row', () => {
  it('rejects SUBMITTED → ACCEPTED (illegal) without updating', async () => {
    lockStatus('SUBMITTED');
    await expect(transition({ charterId: CHARTER_ID, to: 'ACCEPTED' })).rejects.toMatchObject({
      name: 'CharterError',
      code: 'illegal_transition',
    });
    expect(mockTx.charterRequest.update).not.toHaveBeenCalled();
  });

  it('rejects REJECTED → anything (terminal)', async () => {
    lockStatus('REJECTED');
    await expect(
      transition({ charterId: CHARTER_ID, to: 'ADMIN_REVIEW' })
    ).rejects.toBeInstanceOf(CharterError);
    expect(mockTx.charterRequest.update).not.toHaveBeenCalled();
  });

  it('rejects when the charter request does not exist', async () => {
    lockStatus(null);
    await expect(
      transition({ charterId: 'nope', to: 'ADMIN_REVIEW' })
    ).rejects.toMatchObject({ code: 'charter_not_found' });
    expect(mockTx.charterRequest.update).not.toHaveBeenCalled();
  });
});

describe('transitionCharterRequest — admin audit', () => {
  it('writes an AdminAuditLog row INSIDE the tx when actor is present', async () => {
    lockStatus('ADMIN_REVIEW');
    await transition({
      charterId: CHARTER_ID,
      to: 'ASSIGNED_DIRECT',
      assigneeOperatorId: 'op_42',
      acceptByAt: new Date('2026-06-10T00:00:00Z'),
      actor: 'admin:super-1',
    });
    expect(mockWriteAdminAuditLog).toHaveBeenCalledTimes(1);
    expect(mockWriteAdminAuditLog).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        actor: 'admin:super-1',
        action: 'charter-status:ASSIGNED_DIRECT',
        target: CHARTER_ID,
      })
    );
    const args = mockWriteAdminAuditLog.mock.calls[0][1];
    expect(JSON.parse(args.argsRedacted)).toMatchObject({
      from: 'ADMIN_REVIEW',
      to: 'ASSIGNED_DIRECT',
      assigneeOperatorId: 'op_42',
    });
  });

  it('does NOT write an audit row when actor is absent (system caller)', async () => {
    lockStatus('SUBMITTED');
    await transition({ charterId: CHARTER_ID, to: 'ADMIN_REVIEW' });
    expect(mockWriteAdminAuditLog).not.toHaveBeenCalled();
  });
});
