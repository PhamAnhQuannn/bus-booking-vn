/**
 * Unit tests for revokeAdmin (Issue 070).
 *
 * Mock-prisma + writeAdminAuditLog. Asserts: sets status DISABLED inside a
 * transaction + writes the revoke-admin audit row; no_self_revoke when
 * target===actor (checked BEFORE any DB read); admin_not_found when the target
 * row is absent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockWriteAudit } = vi.hoisted(() => ({ mockWriteAudit: vi.fn() }));

vi.mock('@/lib/audit/adminAuditLog', () => ({ writeAdminAuditLog: mockWriteAudit }));

import { revokeAdmin } from '../revokeAdmin';
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

describe('revokeAdmin', () => {
  it('sets status DISABLED + writes the revoke-admin audit row', async () => {
    const { prisma, tx } = makePrisma();
    prisma.adminUser.findUnique.mockResolvedValue({ id: 'target-1' });

    const result = await revokeAdmin(prisma as never, {
      actorAdminId: 'super-1',
      targetAdminId: 'target-1',
      actor: 'admin:super-1',
    });

    expect(result).toEqual({ ok: true });
    expect(tx.adminUser.update).toHaveBeenCalledWith({
      where: { id: 'target-1' },
      data: { status: 'DISABLED' },
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actor: 'admin:super-1',
        action: 'revoke-admin',
        target: 'target-1',
      })
    );
    const auditArgs = JSON.parse(mockWriteAudit.mock.calls[0][1].argsRedacted);
    expect(auditArgs).toEqual({ by: 'super-1' });
  });

  it('throws no_self_revoke when target === actor (before any DB read)', async () => {
    const { prisma, tx } = makePrisma();

    await expect(
      revokeAdmin(prisma as never, {
        actorAdminId: 'super-1',
        targetAdminId: 'super-1',
        actor: 'admin:super-1',
      })
    ).rejects.toMatchObject({ code: 'no_self_revoke' });

    expect(prisma.adminUser.findUnique).not.toHaveBeenCalled();
    expect(tx.adminUser.update).not.toHaveBeenCalled();
  });

  it('throws admin_not_found when the target row is absent', async () => {
    const { prisma, tx } = makePrisma();
    prisma.adminUser.findUnique.mockResolvedValue(null);

    await expect(
      revokeAdmin(prisma as never, {
        actorAdminId: 'super-1',
        targetAdminId: 'ghost',
        actor: 'admin:super-1',
      })
    ).rejects.toBeInstanceOf(AdminServiceError);
    expect(tx.adminUser.update).not.toHaveBeenCalled();
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });
});
