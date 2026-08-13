/**
 * SEC-ADMIN-TOTP-ANCHOR (#564) — TOTP step-up elevation is anchored on AdminSession.totpVerifiedAt
 * and must SURVIVE a refresh rotation (the old code hard-reset it to false every ~10 min).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTx, mockPrisma, signAdminAccessMock } = vi.hoisted(() => {
  const mockTx = {
    adminSession: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    adminUser: { findUnique: vi.fn() },
  };
  return {
    mockTx,
    mockPrisma: { $transaction: vi.fn((fn: (tx: typeof mockTx) => unknown) => fn(mockTx)) },
    signAdminAccessMock: vi.fn(async () => 'mock-admin-access'),
  };
});

vi.mock('@/lib/core/db/client', () => ({ prisma: mockPrisma }));
vi.mock('../jwt', () => ({ signAdminAccess: signAdminAccessMock }));

import { rotateAdminRefresh } from '../adminSession';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REFRESH_TOKEN_SECRET_ADMIN = 'd'.repeat(32);
  mockTx.adminSession.update.mockResolvedValue({});
  mockTx.adminSession.create.mockResolvedValue({ id: 'new' });
  mockTx.adminUser.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN' });
});

const baseSession = {
  id: 'sess-1',
  adminUserId: 'admin-1',
  tokenFamily: 'fam-1',
  rotationCount: 3,
  revokedAt: null,
  expiresAt: new Date(Date.now() + 86_400_000),
};

describe('rotateAdminRefresh — TOTP elevation preserved (#564)', () => {
  it('carries a set totpVerifiedAt forward and mints totpVerified:true', async () => {
    const elevatedAt = new Date('2026-08-13T10:00:00.000Z');
    mockTx.adminSession.findUnique.mockResolvedValueOnce({ ...baseSession, totpVerifiedAt: elevatedAt });

    await rotateAdminRefresh('old-hash');

    // New row inherits the elevation timestamp — NOT reset to null.
    expect(mockTx.adminSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totpVerifiedAt: elevatedAt }) }),
    );
    // The new access token's claim reflects the row (elevated).
    expect(signAdminAccessMock).toHaveBeenCalledWith(expect.objectContaining({ totpVerified: true }));
  });

  it('keeps an unelevated session unelevated (null → totpVerified:false)', async () => {
    mockTx.adminSession.findUnique.mockResolvedValueOnce({ ...baseSession, totpVerifiedAt: null });

    await rotateAdminRefresh('old-hash');

    expect(mockTx.adminSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totpVerifiedAt: null }) }),
    );
    expect(signAdminAccessMock).toHaveBeenCalledWith(expect.objectContaining({ totpVerified: false }));
  });

  it('detects reuse (revoked row) before touching elevation', async () => {
    mockTx.adminSession.findUnique.mockResolvedValueOnce({ ...baseSession, revokedAt: new Date(), totpVerifiedAt: new Date() });
    const result = await rotateAdminRefresh('old-hash');
    expect(result).toEqual({ reuse: true });
    expect(mockTx.adminSession.create).not.toHaveBeenCalled();
  });
});
