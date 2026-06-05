/**
 * Unit tests for resetAdminTotp (Issue 057, lost-TOTP recovery).
 *
 * Mock-prisma + writeAdminAuditLog. Asserts: clears totpSecret/totpEnabledAt +
 * writes audit; no_self_reset when target===actor (BEFORE any DB read);
 * admin_not_found when the target is missing; forbidden when the actor is not an
 * ACTIVE SUPER_ADMIN; break-glass bypassActorCheck skips the actor guard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockWriteAudit } = vi.hoisted(() => ({ mockWriteAudit: vi.fn() }));

vi.mock('@/lib/audit/adminAuditLog', () => ({ writeAdminAuditLog: mockWriteAudit }));

import { resetAdminTotp } from '../resetAdminTotp';
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

const ACTIVE_SUPER = { role: 'SUPER_ADMIN', status: 'ACTIVE' };

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteAudit.mockResolvedValue(undefined);
});

describe('resetAdminTotp', () => {
  it('clears totpSecret/totpEnabledAt and writes an audit row', async () => {
    const { prisma, tx } = makePrisma();
    prisma.adminUser.findUnique
      .mockResolvedValueOnce(ACTIVE_SUPER) // actor lookup
      .mockResolvedValueOnce({ id: 'target-1' }); // target lookup
    tx.adminUser.update.mockResolvedValue({});

    const result = await resetAdminTotp(prisma as never, {
      actorAdminId: 'super-1',
      targetAdminId: 'target-1',
      actor: 'admin:super-1',
    });

    expect(result).toEqual({ ok: true });
    const updateArg = tx.adminUser.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'target-1' });
    expect(updateArg.data).toEqual({ totpSecret: null, totpEnabledAt: null });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actor: 'admin:super-1',
        action: 'reset-admin-totp',
        target: 'target-1',
      })
    );
    const auditArgs = JSON.parse(mockWriteAudit.mock.calls[0][1].argsRedacted);
    expect(auditArgs).toEqual({ by: 'super-1' });
  });

  it('throws no_self_reset when target===actor (before any DB read)', async () => {
    const { prisma, tx } = makePrisma();

    await expect(
      resetAdminTotp(prisma as never, {
        actorAdminId: 'super-1',
        targetAdminId: 'super-1',
        actor: 'admin:super-1',
      })
    ).rejects.toMatchObject({ code: 'no_self_reset' });

    expect(prisma.adminUser.findUnique).not.toHaveBeenCalled();
    expect(tx.adminUser.update).not.toHaveBeenCalled();
  });

  it('throws forbidden when the actor is not an ACTIVE SUPER_ADMIN', async () => {
    const { prisma, tx } = makePrisma();
    prisma.adminUser.findUnique.mockResolvedValueOnce({ role: 'FINANCE', status: 'ACTIVE' });

    await expect(
      resetAdminTotp(prisma as never, {
        actorAdminId: 'finance-1',
        targetAdminId: 'target-1',
        actor: 'admin:finance-1',
      })
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(tx.adminUser.update).not.toHaveBeenCalled();
  });

  it('throws admin_not_found when the target does not exist', async () => {
    const { prisma, tx } = makePrisma();
    prisma.adminUser.findUnique
      .mockResolvedValueOnce(ACTIVE_SUPER) // actor
      .mockResolvedValueOnce(null); // target missing

    await expect(
      resetAdminTotp(prisma as never, {
        actorAdminId: 'super-1',
        targetAdminId: 'ghost',
        actor: 'admin:super-1',
      })
    ).rejects.toMatchObject({ code: 'admin_not_found' });
    expect(tx.adminUser.update).not.toHaveBeenCalled();
  });

  it('break-glass bypassActorCheck skips the actor guard but still resets + audits', async () => {
    const { prisma, tx } = makePrisma();
    // Only the target lookup happens — actor lookup is skipped.
    prisma.adminUser.findUnique.mockResolvedValueOnce({ id: 'target-1' });
    tx.adminUser.update.mockResolvedValue({});

    const result = await resetAdminTotp(prisma as never, {
      actorAdminId: 'cli:break-glass',
      targetAdminId: 'target-1',
      actor: 'cli:break-glass',
      bypassActorCheck: true,
    });

    expect(result).toEqual({ ok: true });
    // Exactly one findUnique (target), not two — actor guard bypassed.
    expect(prisma.adminUser.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.adminUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'target-1' } })
    );
    expect(tx.adminUser.update).toHaveBeenCalled();
    expect(mockWriteAudit).toHaveBeenCalled();
  });

  it('throws AdminServiceError instances (not plain errors)', async () => {
    const { prisma } = makePrisma();
    await expect(
      resetAdminTotp(prisma as never, {
        actorAdminId: 'a',
        targetAdminId: 'a',
        actor: 'admin:a',
      })
    ).rejects.toBeInstanceOf(AdminServiceError);
  });
});
