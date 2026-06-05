/**
 * Unit tests for suspendCustomer / reinstateCustomer (Issue 066).
 *
 * Mock-prisma + writeAdminAuditLog. Asserts:
 *   suspend → stamps suspendedAt, revokes all live sessions, writes 'suspend-customer' audit.
 *   reinstate → clears suspendedAt, writes 'reinstate-customer' audit, does NOT touch sessions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockWriteAudit } = vi.hoisted(() => ({ mockWriteAudit: vi.fn() }));
vi.mock('@/lib/audit/adminAuditLog', () => ({ writeAdminAuditLog: mockWriteAudit }));

import { suspendCustomer, reinstateCustomer } from '../suspendCustomer';

function makePrisma() {
  const tx = {
    customer: { update: vi.fn() },
    session: { updateMany: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  return { prisma, tx };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteAudit.mockResolvedValue(undefined);
});

describe('suspendCustomer', () => {
  it('stamps suspendedAt, revokes all live sessions, and writes a suspend-customer audit', async () => {
    const { prisma, tx } = makePrisma();
    tx.session.updateMany.mockResolvedValue({ count: 3 });

    await suspendCustomer(prisma as never, { customerId: 'cust-1', actor: 'admin:a1' });

    // suspendedAt stamped (a Date, not null).
    expect(tx.customer.update).toHaveBeenCalledTimes(1);
    const updateArg = tx.customer.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'cust-1' });
    expect(updateArg.data.suspendedAt).toBeInstanceOf(Date);

    // all live sessions revoked (revokedAt: null → set).
    expect(tx.session.updateMany).toHaveBeenCalledTimes(1);
    const revokeArg = tx.session.updateMany.mock.calls[0][0];
    expect(revokeArg.where).toEqual({ customerId: 'cust-1', revokedAt: null });
    expect(revokeArg.data.revokedAt).toBeInstanceOf(Date);

    // audit row.
    expect(mockWriteAudit).toHaveBeenCalledTimes(1);
    expect(mockWriteAudit).toHaveBeenCalledWith(tx, {
      actor: 'admin:a1',
      action: 'suspend-customer',
      target: 'cust-1',
      argsRedacted: JSON.stringify({ sessionsRevoked: 3 }),
    });
  });
});

describe('reinstateCustomer', () => {
  it('clears suspendedAt, writes a reinstate-customer audit, and does NOT restore sessions', async () => {
    const { prisma, tx } = makePrisma();

    await reinstateCustomer(prisma as never, { customerId: 'cust-2', actor: 'admin:a2' });

    expect(tx.customer.update).toHaveBeenCalledTimes(1);
    expect(tx.customer.update.mock.calls[0][0]).toEqual({
      where: { id: 'cust-2' },
      data: { suspendedAt: null },
    });

    // sessions are intentionally untouched on reinstate.
    expect(tx.session.updateMany).not.toHaveBeenCalled();

    expect(mockWriteAudit).toHaveBeenCalledTimes(1);
    expect(mockWriteAudit).toHaveBeenCalledWith(tx, {
      actor: 'admin:a2',
      action: 'reinstate-customer',
      target: 'cust-2',
    });
  });
});
