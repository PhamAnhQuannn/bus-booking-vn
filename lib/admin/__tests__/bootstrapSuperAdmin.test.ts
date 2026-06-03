/**
 * Unit tests for bootstrapSuperAdmin (Issue 057).
 *
 * Mock-prisma (reuse-by-param: the service takes the client as its first arg),
 * password.hash, and writeAdminAuditLog. Asserts: creates when none exists (audit
 * written, role SUPER_ADMIN, invitedBy null); idempotent re-run guard (existing
 * super-admin → created:false, no create); P2002 → email_in_use.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

const { mockHash, mockWriteAudit } = vi.hoisted(() => ({
  mockHash: vi.fn(),
  mockWriteAudit: vi.fn(),
}));

vi.mock('@/lib/auth/password', () => ({ hash: mockHash }));
vi.mock('@/lib/audit/adminAuditLog', () => ({ writeAdminAuditLog: mockWriteAudit }));

import { bootstrapSuperAdmin } from '../bootstrapSuperAdmin';
import { AdminServiceError } from '../errors';

function makePrisma(overrides: Record<string, unknown> = {}) {
  const tx = {
    adminUser: { create: vi.fn() },
  };
  const prisma = {
    adminUser: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    ...overrides,
  };
  return { prisma, tx };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHash.mockResolvedValue('hashed-pw');
  mockWriteAudit.mockResolvedValue(undefined);
});

describe('bootstrapSuperAdmin', () => {
  it('creates a SUPER_ADMIN and writes an audit row when none exists', async () => {
    const { prisma, tx } = makePrisma();
    prisma.adminUser.findFirst.mockResolvedValue(null);
    tx.adminUser.create.mockResolvedValue({ id: 'admin-new' });

    const result = await bootstrapSuperAdmin(prisma as never, {
      email: 'root@example.com',
      password: 'GenesisPass1',
      actor: 'cli:bootstrap',
    });

    expect(result).toEqual({ created: true, adminUserId: 'admin-new' });
    expect(mockHash).toHaveBeenCalledWith('GenesisPass1');

    const createArg = tx.adminUser.create.mock.calls[0][0];
    expect(createArg.data).toMatchObject({
      email: 'root@example.com',
      passwordHash: 'hashed-pw',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      invitedBy: null,
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actor: 'cli:bootstrap',
        action: 'bootstrap-super-admin',
        target: 'admin-new',
      })
    );
    // Audit args redact to email only (no password).
    const auditArgs = JSON.parse(mockWriteAudit.mock.calls[0][1].argsRedacted);
    expect(auditArgs).toEqual({ email: 'root@example.com' });
  });

  it('is idempotent — an existing super-admin short-circuits with created:false and no create', async () => {
    const { prisma, tx } = makePrisma();
    prisma.adminUser.findFirst.mockResolvedValue({ id: 'admin-existing' });

    const result = await bootstrapSuperAdmin(prisma as never, {
      email: 'root@example.com',
      password: 'GenesisPass1',
      actor: 'cli:bootstrap',
    });

    expect(result).toEqual({ created: false, adminUserId: 'admin-existing' });
    expect(tx.adminUser.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mockWriteAudit).not.toHaveBeenCalled();
    expect(mockHash).not.toHaveBeenCalled();
  });

  it('maps a P2002 unique-violation to email_in_use', async () => {
    const { prisma, tx } = makePrisma();
    prisma.adminUser.findFirst.mockResolvedValue(null);
    tx.adminUser.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' })
    );

    await expect(
      bootstrapSuperAdmin(prisma as never, {
        email: 'root@example.com',
        password: 'GenesisPass1',
        actor: 'cli:bootstrap',
      })
    ).rejects.toBeInstanceOf(AdminServiceError);
    await expect(
      bootstrapSuperAdmin(prisma as never, {
        email: 'root@example.com',
        password: 'GenesisPass1',
        actor: 'cli:bootstrap',
      })
    ).rejects.toMatchObject({ code: 'email_in_use' });
  });
});
