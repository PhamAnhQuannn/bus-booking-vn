/**
 * SEC-ADMIN-TOTP-ANCHOR (#564) — TOTP step-up elevation is anchored on AdminSession.totpVerifiedAt
 * and must SURVIVE a refresh rotation (the old code hard-reset it to false every ~10 min).
 *
 * SEC-#589 — rotateAdminRefresh now locks the row FOR UPDATE (raw SELECT), enforces expiresAt,
 * and returns a benign-race sentinel instead of forking the token family.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTx, mockPrisma, signAdminAccessMock } = vi.hoisted(() => {
  const mockTx = {
    // #589: rotate locks the row via a raw SELECT … FOR UPDATE.
    $queryRaw: vi.fn(),
    adminSession: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
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
  mockTx.adminSession.updateMany.mockResolvedValue({ count: 1 }); // guarded revoke succeeds
  mockTx.adminSession.create.mockResolvedValue({ id: 'new' });
  mockTx.adminUser.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN' });
});

const baseSession = {
  id: 'sess-1',
  adminUserId: 'admin-1',
  tokenFamily: 'fam-1',
  rotationCount: 3,
  revokedAt: null as Date | null,
  expiresAt: new Date(Date.now() + 86_400_000),
};

describe('rotateAdminRefresh — TOTP elevation preserved (#564)', () => {
  it('carries a set totpVerifiedAt forward and mints totpVerified:true', async () => {
    const elevatedAt = new Date('2026-08-13T10:00:00.000Z');
    mockTx.$queryRaw.mockResolvedValueOnce([{ ...baseSession, totpVerifiedAt: elevatedAt }]);

    await rotateAdminRefresh('old-hash');

    // New row inherits the elevation timestamp — NOT reset to null.
    expect(mockTx.adminSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totpVerifiedAt: elevatedAt }) }),
    );
    // The new access token's claim reflects the row (elevated).
    expect(signAdminAccessMock).toHaveBeenCalledWith(expect.objectContaining({ totpVerified: true }));
  });

  it('keeps an unelevated session unelevated (null → totpVerified:false)', async () => {
    mockTx.$queryRaw.mockResolvedValueOnce([{ ...baseSession, totpVerifiedAt: null }]);

    await rotateAdminRefresh('old-hash');

    expect(mockTx.adminSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totpVerifiedAt: null }) }),
    );
    expect(signAdminAccessMock).toHaveBeenCalledWith(expect.objectContaining({ totpVerified: false }));
  });

  it('detects reuse (revoked row, no live successor) before touching elevation', async () => {
    // Revoked well beyond the grace window → genuine replay; the successor lookup is skipped.
    mockTx.$queryRaw.mockResolvedValueOnce([
      { ...baseSession, revokedAt: new Date(Date.now() - 5 * 60 * 1000), totpVerifiedAt: new Date() },
    ]);

    const result = await rotateAdminRefresh('old-hash');
    expect(result).toEqual({ reuse: true });
    expect(mockTx.adminSession.findFirst).not.toHaveBeenCalled();
    expect(mockTx.adminSession.create).not.toHaveBeenCalled();
  });
});

describe('rotateAdminRefresh — lock + expiry + race (#589)', () => {
  it('throws SESSION_NOT_FOUND when the locking read finds no row', async () => {
    mockTx.$queryRaw.mockResolvedValueOnce([]);
    await expect(rotateAdminRefresh('ghost-hash')).rejects.toThrow('SESSION_NOT_FOUND');
  });

  it('a second rotation of a just-revoked token with NO live successor revokes the family (no fork)', async () => {
    mockTx.$queryRaw.mockResolvedValueOnce([{ ...baseSession, revokedAt: new Date(), totpVerifiedAt: null }]);
    mockTx.adminSession.findFirst.mockResolvedValueOnce(null);

    const result = await rotateAdminRefresh('old-hash');

    expect(result).toEqual({ reuse: true });
    expect(mockTx.adminSession.create).not.toHaveBeenCalled();
    expect(mockTx.adminSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenFamily: baseSession.tokenFamily } }),
    );
  });

  it('a benign race (revoked within grace + live successor) returns { raced } with elevation from the SUCCESSOR', async () => {
    const successorElevatedAt = new Date('2026-08-14T09:00:00.000Z');
    mockTx.$queryRaw.mockResolvedValueOnce([{ ...baseSession, revokedAt: new Date(), totpVerifiedAt: null }]);
    // The live successor is elevated even though the replayed loser row was not.
    mockTx.adminSession.findFirst.mockResolvedValueOnce({ id: 'successor', totpVerifiedAt: successorElevatedAt });

    const result = await rotateAdminRefresh('old-hash');

    expect(result).toMatchObject({ raced: true });
    expect((result as { accessToken: string }).accessToken).toBeTruthy();
    // No fork: no new row, no family revoke.
    expect(mockTx.adminSession.create).not.toHaveBeenCalled();
    expect(mockTx.adminSession.updateMany).not.toHaveBeenCalled();
    // Elevation reflects the live successor row, not the replayed loser.
    expect(signAdminAccessMock).toHaveBeenCalledWith(expect.objectContaining({ totpVerified: true }));
  });

  it('an expired session returns { expired } and revokes the row (no rotation)', async () => {
    mockTx.$queryRaw.mockResolvedValueOnce([
      { ...baseSession, expiresAt: new Date(Date.now() - 1000), totpVerifiedAt: null },
    ]);

    const result = await rotateAdminRefresh('old-hash');

    expect(result).toEqual({ expired: true });
    expect(mockTx.adminSession.create).not.toHaveBeenCalled();
    expect(mockTx.adminSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: baseSession.id, revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });
});
