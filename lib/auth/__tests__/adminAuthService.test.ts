/**
 * Unit tests for lib/auth/adminAuthService — adminLogin (Issue 054).
 * Mocks prisma.adminUser + password.verify.
 *
 * No-enumeration contract: missing email, DISABLED status, and wrong password
 * all return the SAME { ok: false } shape and never throw.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAdminFindUnique, mockVerifyPassword } = vi.hoisted(() => ({
  mockAdminFindUnique: vi.fn(),
  mockVerifyPassword: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    adminUser: { findUnique: mockAdminFindUnique },
  },
}));
vi.mock('../password', () => ({ verify: mockVerifyPassword }));

import { adminLogin } from '../adminAuthService';

const ACTIVE_ADMIN = {
  id: 'admin-1',
  passwordHash: '$argon2id$hash',
  role: 'FINANCE',
  status: 'ACTIVE',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('adminLogin', () => {
  it('returns { ok: true, adminUserId, role } on valid credentials', async () => {
    mockAdminFindUnique.mockResolvedValue(ACTIVE_ADMIN);
    mockVerifyPassword.mockResolvedValue(true);
    const result = await adminLogin('admin@example.com', 'CorrectPassword1');
    expect(result).toEqual({ ok: true, adminUserId: 'admin-1', role: 'FINANCE' });
  });

  it('returns { ok: false } on wrong password', async () => {
    mockAdminFindUnique.mockResolvedValue(ACTIVE_ADMIN);
    mockVerifyPassword.mockResolvedValue(false);
    const result = await adminLogin('admin@example.com', 'WrongPassword');
    expect(result).toEqual({ ok: false });
  });

  it('returns { ok: false } for unknown email (no throw, same shape)', async () => {
    mockAdminFindUnique.mockResolvedValue(null);
    mockVerifyPassword.mockResolvedValue(false);
    const result = await adminLogin('nobody@example.com', 'anything');
    expect(result).toEqual({ ok: false });
    // Dummy verify must still run for timing parity.
    expect(mockVerifyPassword).toHaveBeenCalled();
  });

  it('returns { ok: false } for DISABLED admin (even with correct password)', async () => {
    mockAdminFindUnique.mockResolvedValue({ ...ACTIVE_ADMIN, status: 'DISABLED' });
    mockVerifyPassword.mockResolvedValue(true);
    const result = await adminLogin('admin@example.com', 'CorrectPassword1');
    expect(result).toEqual({ ok: false });
  });
});
