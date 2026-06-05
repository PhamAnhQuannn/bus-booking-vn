/**
 * Unit tests for setAdminRole (Issue 070).
 *
 * Mock-prisma + writeAdminAuditLog. Asserts: updates role inside a transaction +
 * writes the set-admin-role audit row; no_self_role_change when target===actor
 * (before any DB read); invalid_role rejected (before any DB read); admin_not_found
 * when the target row is absent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockWriteAudit } = vi.hoisted(() => ({ mockWriteAudit: vi.fn() }));

vi.mock('@/lib/audit/adminAuditLog', () => ({ writeAdminAuditLog: mockWriteAudit }));

import { setAdminRole } from '../setAdminRole';
import { AdminServiceError } from '../errors';

function makePrisma() {
  const tx = {
    adminUser: { update: vi.fn() },
  };
  const prisma = {
    adminUser: { findUnique: vi.fn() },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  return { prisma, tx };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteAudit.mockResolvedValue(undefined);
});

describe('setAdminRole', () => {
  it('updates the role + writes the set-admin-role audit row', async () => {
    const { prisma, tx } = makePrisma();
    prisma.adminUser.findUnique.mockResolvedValue({ id: 'target-1' });

    const result = await setAdminRole(prisma as never, {
      actorAdminId: 'super-1',
      targetAdminId: 'target-1',
      role: 'FINANCE',
      actor: 'admin:super-1',
    });

    expect(result).toEqual({ ok: true });
    expect(tx.adminUser.update).toHaveBeenCalledWith({
      where: { id: 'target-1' },
      data: { role: 'FINANCE' },
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actor: 'admin:super-1',
        action: 'set-admin-role',
        target: 'target-1',
      })
    );
    const auditArgs = JSON.parse(mockWriteAudit.mock.calls[0][1].argsRedacted);
    expect(auditArgs).toEqual({ role: 'FINANCE' });
  });

  it('throws no_self_role_change when target === actor (before any DB read)', async () => {
    const { prisma, tx } = makePrisma();

    await expect(
      setAdminRole(prisma as never, {
        actorAdminId: 'super-1',
        targetAdminId: 'super-1',
        role: 'SUPPORT',
        actor: 'admin:super-1',
      })
    ).rejects.toMatchObject({ code: 'no_self_role_change' });

    expect(prisma.adminUser.findUnique).not.toHaveBeenCalled();
    expect(tx.adminUser.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid role (before any DB read)', async () => {
    const { prisma } = makePrisma();

    await expect(
      setAdminRole(prisma as never, {
        actorAdminId: 'super-1',
        targetAdminId: 'target-1',
        role: 'ROOT',
        actor: 'admin:super-1',
      })
    ).rejects.toMatchObject({ code: 'invalid_role' });

    expect(prisma.adminUser.findUnique).not.toHaveBeenCalled();
  });

  it('throws admin_not_found when the target row is absent', async () => {
    const { prisma, tx } = makePrisma();
    prisma.adminUser.findUnique.mockResolvedValue(null);

    await expect(
      setAdminRole(prisma as never, {
        actorAdminId: 'super-1',
        targetAdminId: 'ghost',
        role: 'FINANCE',
        actor: 'admin:super-1',
      })
    ).rejects.toBeInstanceOf(AdminServiceError);
    expect(tx.adminUser.update).not.toHaveBeenCalled();
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });
});
