/**
 * Unit tests for createOperatorAccount (2026-06-06, S05).
 * Provisions an operator's bootstrap login account from an existing application:
 * generates username + temp password, flips APPROVED, audits, enqueues the
 * credentials email. prisma + auth/staff/audit deps are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockTx,
  mockPrisma,
  mockHash,
  mockGenTempPassword,
  mockBuildUsername,
  mockEnsureUnique,
  mockWriteAudit,
} = vi.hoisted(() => {
  const mockTx = {
    operator: { findUnique: vi.fn(), update: vi.fn() },
    operatorUser: { count: vi.fn(), create: vi.fn() },
  };
  const mockPrisma = {
    $transaction: vi.fn(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    notificationLog: { create: vi.fn() },
  };
  return {
    mockTx,
    mockPrisma,
    mockHash: vi.fn(),
    mockGenTempPassword: vi.fn(),
    mockBuildUsername: vi.fn(),
    mockEnsureUnique: vi.fn(),
    mockWriteAudit: vi.fn(),
  };
});

vi.mock('@/lib/auth', () => ({
  hash: mockHash,
  buildUsername: mockBuildUsername,
  ensureUniqueUsername: mockEnsureUnique,
}));
vi.mock('@/lib/staff', () => ({ genTempPassword: mockGenTempPassword }));
vi.mock('@/lib/audit', () => ({
  writeAdminAuditLog: mockWriteAudit,
  redactPhone: (p: string) => `redacted(${p})`,
}));

import { createOperatorAccount } from '../createOperatorAccount';
import { AdminServiceError } from '../errors';
import type { PrismaClient } from '@prisma/client';

const prisma = mockPrisma as unknown as PrismaClient;

const INPUT = { operatorId: 'op_1', baseUrl: 'http://localhost:3001', actor: 'admin:adm_1' };

beforeEach(() => {
  vi.clearAllMocks();
  mockGenTempPassword.mockReturnValue('Temp-Pass-123');
  mockHash.mockResolvedValue('hashed');
  mockBuildUsername.mockReturnValue('PB-0001');
  mockEnsureUnique.mockResolvedValue('PB-0001');
  mockTx.operator.findUnique.mockResolvedValue({
    id: 'op_1',
    brandName: 'Phương Bắc',
    legalName: 'Cong ty ABC',
    contactEmail: 'lienhe@abc.vn',
    contactPhone: '+84901230001',
    notificationPhone: null,
  });
  mockTx.operatorUser.count.mockResolvedValue(0);
  mockTx.operatorUser.create.mockResolvedValue({ id: 'opu_1' });
  mockTx.operator.update.mockResolvedValue({});
  mockPrisma.notificationLog.create.mockResolvedValue({ id: 'notif_1' });
});

describe('createOperatorAccount', () => {
  it('creates the OperatorUser with username + forced password change, flips APPROVED', async () => {
    const result = await createOperatorAccount(prisma, INPUT);

    expect(result).toEqual({ operatorUserId: 'opu_1', username: 'PB-0001', tempPassword: 'Temp-Pass-123' });

    const userData = mockTx.operatorUser.create.mock.calls[0][0].data;
    expect(userData.username).toBe('PB-0001');
    expect(userData.role).toBe('admin');
    expect(userData.requiresPasswordChange).toBe(true);
    expect(userData.passwordHash).toBe('hashed');
    expect(userData.displayName).toBe('Phương Bắc');
    expect(userData.tempPasswordPlain).toBe('Temp-Pass-123');

    expect(mockTx.operator.update).toHaveBeenCalledWith({
      where: { id: 'op_1' },
      data: { status: 'APPROVED' },
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ action: 'create-operator-account', target: 'op_1' }),
    );
  });

  it('enqueues the operatorAccountCreated email WITHOUT the temp password (set-password link only)', async () => {
    await createOperatorAccount(prisma, INPUT);

    expect(mockPrisma.notificationLog.create).toHaveBeenCalledTimes(1);
    const data = mockPrisma.notificationLog.create.mock.calls[0][0].data;
    expect(data.channel).toBe('email');
    expect(data.template).toBe('operatorAccountCreated');
    expect(data.recipient).toBe('lienhe@abc.vn');
    expect(data.status).toBe('pending');
    expect(data.payload).toContain('PB-0001');
    // The cleartext temp password must NEVER be written to NotificationLog.
    expect(data.payload).not.toContain('Temp-Pass-123');
    // Instead the body carries the OTP-backed self-serve set-password link.
    expect(data.payload).toContain('/op/forgot-password');
  });

  it('throws operator_not_found when the application is missing', async () => {
    mockTx.operator.findUnique.mockResolvedValue(null);
    await expect(createOperatorAccount(prisma, INPUT)).rejects.toMatchObject({
      name: 'AdminServiceError',
      code: 'operator_not_found',
    });
    expect(mockTx.operatorUser.create).not.toHaveBeenCalled();
  });

  it('throws account_already_exists when an OperatorUser already exists', async () => {
    mockTx.operatorUser.count.mockResolvedValue(1);
    await expect(createOperatorAccount(prisma, INPUT)).rejects.toBeInstanceOf(AdminServiceError);
    expect(mockTx.operatorUser.create).not.toHaveBeenCalled();
    expect(mockPrisma.notificationLog.create).not.toHaveBeenCalled();
  });
});
