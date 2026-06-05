/**
 * Unit tests for inviteAdmin (Issue 057).
 *
 * Mock-prisma, password.hash, genTempPassword, writeAdminAuditLog. Asserts:
 * creates an AdminUser with invitedBy + returns the temp password + audit row;
 * forbidden when inviter is not an ACTIVE SUPER_ADMIN; email_in_use on dup (P2002).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

const { mockHash, mockGenTemp, mockWriteAudit } = vi.hoisted(() => ({
  mockHash: vi.fn(),
  mockGenTemp: vi.fn(),
  mockWriteAudit: vi.fn(),
}));

vi.mock('@/lib/auth/password', () => ({ hash: mockHash }));
vi.mock('@/lib/staff/genTempPassword', () => ({ genTempPassword: mockGenTemp }));
vi.mock('@/lib/audit/adminAuditLog', () => ({ writeAdminAuditLog: mockWriteAudit }));

import { inviteAdmin } from '../inviteAdmin';
import { AdminServiceError } from '../errors';

function makePrisma() {
  const tx = {
    adminUser: { create: vi.fn() },
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
  mockHash.mockResolvedValue('hashed-temp');
  mockGenTemp.mockReturnValue('TempPass123x');
  mockWriteAudit.mockResolvedValue(undefined);
});

describe('inviteAdmin', () => {
  it('creates an AdminUser with invitedBy + returns the temp password + writes audit', async () => {
    const { prisma, tx } = makePrisma();
    prisma.adminUser.findUnique.mockResolvedValue(ACTIVE_SUPER);
    tx.adminUser.create.mockResolvedValue({ id: 'invitee-1' });

    const result = await inviteAdmin(prisma as never, {
      inviterAdminId: 'super-1',
      email: 'finance@example.com',
      role: 'FINANCE',
      actor: 'admin:super-1',
    });

    expect(result).toEqual({ adminUserId: 'invitee-1', tempPassword: 'TempPass123x' });
    expect(mockHash).toHaveBeenCalledWith('TempPass123x');

    const createArg = tx.adminUser.create.mock.calls[0][0];
    expect(createArg.data).toMatchObject({
      email: 'finance@example.com',
      passwordHash: 'hashed-temp',
      role: 'FINANCE',
      status: 'ACTIVE',
      invitedBy: 'super-1',
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actor: 'admin:super-1',
        action: 'invite-admin',
        target: 'invitee-1',
      })
    );
    const auditArgs = JSON.parse(mockWriteAudit.mock.calls[0][1].argsRedacted);
    expect(auditArgs).toEqual({ email: 'finance@example.com', role: 'FINANCE' });
  });

  it('throws forbidden when the inviter is not an ACTIVE SUPER_ADMIN', async () => {
    const { prisma, tx } = makePrisma();
    prisma.adminUser.findUnique.mockResolvedValue({ role: 'FINANCE', status: 'ACTIVE' });

    await expect(
      inviteAdmin(prisma as never, {
        inviterAdminId: 'finance-1',
        email: 'x@example.com',
        role: 'SUPPORT',
        actor: 'admin:finance-1',
      })
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(tx.adminUser.create).not.toHaveBeenCalled();
  });

  it('throws forbidden when the inviter does not exist', async () => {
    const { prisma } = makePrisma();
    prisma.adminUser.findUnique.mockResolvedValue(null);

    await expect(
      inviteAdmin(prisma as never, {
        inviterAdminId: 'ghost',
        email: 'x@example.com',
        role: 'SUPPORT',
        actor: 'admin:ghost',
      })
    ).rejects.toBeInstanceOf(AdminServiceError);
  });

  it('maps a P2002 unique-violation to email_in_use', async () => {
    const { prisma, tx } = makePrisma();
    prisma.adminUser.findUnique.mockResolvedValue(ACTIVE_SUPER);
    tx.adminUser.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' })
    );

    await expect(
      inviteAdmin(prisma as never, {
        inviterAdminId: 'super-1',
        email: 'dup@example.com',
        role: 'SUPPORT',
        actor: 'admin:super-1',
      })
    ).rejects.toMatchObject({ code: 'email_in_use' });
  });
});
