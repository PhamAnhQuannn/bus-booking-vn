/**
 * Unit tests for lib/auth/session.ts
 * Prisma is fully mocked — no real DB needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- vi.hoisted: declare mocks before hoisted vi.mock factories run ----
const { mockTx, mockPrisma } = vi.hoisted(() => {
  const mockTx = {
    session: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const mockPrisma = {
    $transaction: vi.fn(),
    session: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  return { mockTx, mockPrisma };
});

vi.mock('@/lib/core/db/client', () => ({
  prisma: mockPrisma,
}));

vi.mock('../jwt', () => ({
  signAccess: vi.fn(async ({ sub }: { sub: string; role: string }) => `mock-access-${sub}`),
}));

vi.mock('../refreshToken', () => ({
  produce: vi.fn(({ tokenId }: { tokenId: string }) => ({
    token: `mock-refresh-token-${tokenId}`,
    hash: `mock-refresh-hash-${tokenId}`,
  })),
  generateFamily: vi.fn(() => 'mock-family-uuid'),
}));

vi.mock('../csrf', () => ({
  generateToken: vi.fn(() => 'mock-csrf-token'),
}));

import { rotateRefresh, createSession, revokeSession } from '../session';

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.REFRESH_TOKEN_SECRET;

  // By default, $transaction calls the callback with mockTx
  mockPrisma.$transaction.mockImplementation(
    (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)
  );
  // NODE_ENV is already 'test' in vitest — no assignment needed
});

// ---------------------------------------------------------------------------
// rotateRefresh — happy path
// ---------------------------------------------------------------------------
describe('rotateRefresh', () => {
  it('returns access + refreshToken + refreshHash + csrf on success', async () => {
    const existingSession = {
      id: 'sess-001',
      customerId: 'cust-001',
      tokenFamily: 'family-abc',
      rotationCount: 2,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    mockTx.session.findUnique.mockResolvedValueOnce(existingSession);
    mockTx.session.update.mockResolvedValueOnce({ id: 'sess-001' });
    mockTx.session.create.mockResolvedValueOnce({ id: 'sess-002' });

    const result = await rotateRefresh('old-hash-abc', '127.0.0.1');

    expect('reuse' in result).toBe(false);
    const r = result as { access: string; refreshToken: string; refreshHash: string; csrf: string };
    expect(r.access).toContain('mock-access-cust-001');
    expect(typeof r.refreshToken).toBe('string');
    expect(typeof r.refreshHash).toBe('string');
    expect(r.csrf).toBe('mock-csrf-token');
  });

  it('increments rotationCount in new session create call', async () => {
    const existingSession = {
      id: 'sess-010',
      customerId: 'cust-010',
      tokenFamily: 'fam-010',
      rotationCount: 5,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    mockTx.session.findUnique.mockResolvedValueOnce(existingSession);
    mockTx.session.update.mockResolvedValueOnce({});
    mockTx.session.create.mockResolvedValueOnce({ id: 'sess-011' });

    await rotateRefresh('old-hash-010', null);

    const createCall = mockTx.session.create.mock.calls[0][0];
    expect(createCall.data.rotationCount).toBe(6);
    expect(createCall.data.tokenFamily).toBe('fam-010');
  });

  it('returns { reuse: true } and revokes entire family when session already revoked', async () => {
    const revokedSession = {
      id: 'sess-100',
      customerId: 'cust-100',
      tokenFamily: 'fam-reuse',
      rotationCount: 1,
      revokedAt: new Date('2026-01-01'),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    mockTx.session.findUnique.mockResolvedValueOnce(revokedSession);
    mockTx.session.updateMany.mockResolvedValueOnce({ count: 3 });

    const result = await rotateRefresh('revoked-hash', '10.0.0.1');

    expect(result).toEqual({ reuse: true });
    expect(mockTx.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tokenFamily: 'fam-reuse' }),
      })
    );
  });

  it('throws SESSION_NOT_FOUND when no session matches hash', async () => {
    mockTx.session.findUnique.mockResolvedValueOnce(null);

    await expect(rotateRefresh('nonexistent-hash', null)).rejects.toThrow(
      'SESSION_NOT_FOUND'
    );
  });
});

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------
describe('createSession', () => {
  it('returns access + refreshToken + refreshHash + csrf + family', async () => {
    mockPrisma.session.create.mockResolvedValueOnce({ id: 'new-sess-001' });

    const result = await createSession('cust-new', '192.168.1.1');

    expect(result.access).toContain('mock-access-cust-new');
    expect(typeof result.refreshToken).toBe('string');
    expect(typeof result.refreshHash).toBe('string');
    expect(result.csrf).toBe('mock-csrf-token');
    expect(typeof result.family).toBe('string');
  });

  it('passes customerId and family to session.create', async () => {
    mockPrisma.session.create.mockResolvedValueOnce({ id: 'new-sess-002' });

    await createSession('cust-xyz', null);

    expect(mockPrisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'cust-xyz',
          rotationCount: 0,
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// revokeSession
// ---------------------------------------------------------------------------
describe('revokeSession', () => {
  it('calls session.update with revokedAt and does not throw', async () => {
    mockPrisma.session.update.mockResolvedValueOnce({ id: 'sess-rev' });

    await expect(revokeSession('some-hash')).resolves.toBeUndefined();
    expect(mockPrisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { refreshTokenHash: 'some-hash' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      })
    );
  });

  it('does not throw when session.update rejects (idempotent)', async () => {
    mockPrisma.session.update.mockRejectedValueOnce(new Error('Record not found'));

    await expect(revokeSession('nonexistent-hash')).resolves.toBeUndefined();
  });
});
