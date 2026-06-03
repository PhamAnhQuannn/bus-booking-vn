/**
 * Unit tests for lib/auth/operatorSession.ts
 *
 * Tests family-rotation logic for operator refresh tokens:
 * - issueOperatorSession: creates a new session with a fresh tokenFamily
 * - rotateOperatorRefresh: rotates on valid token, revokes family on reuse
 * - revokeOperatorSession: soft-deletes a single session
 * - revokeAllOperatorSessions: revokes all sessions for an operator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before imports
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => {
  const operatorSession = {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const operatorUser = {
    findUnique: vi.fn().mockResolvedValue({ operatorId: 'op-org-1', role: 'admin' }),
  };
  const txProxy = { operatorSession, operatorUser };
  return {
    $transaction: vi.fn(async (fn: (tx: typeof txProxy) => Promise<unknown>) => fn(txProxy)),
    operatorSession,
    operatorUser,
  };
});

vi.mock('@/lib/core/db/client', () => ({ prisma: mockPrisma }));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  issueOperatorSession,
  rotateOperatorRefresh,
  revokeOperatorSession,
  revokeAllOperatorSessions,
} from '../operatorSession';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<{
  id: string;
  operatorUserId: string;
  tokenFamily: string;
  rotationCount: number;
  revokedAt: Date | null;
}> = {}) {
  return {
    id: 'sess-1',
    operatorUserId: 'op-user-1',
    refreshTokenHash: 'hash-1',
    tokenFamily: 'family-uuid-1',
    rotationCount: 0,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    revokedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// issueOperatorSession
// ---------------------------------------------------------------------------

describe('issueOperatorSession', () => {
  it('creates a session with rotationCount=0 and a new tokenFamily', async () => {
    mockPrisma.operatorSession.create.mockResolvedValue(makeSession());

    const result = await issueOperatorSession('op-user-1', false, 'op-org-1');

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result).toHaveProperty('refreshHash');
    expect(result).toHaveProperty('family');

    expect(mockPrisma.operatorSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operatorUserId: 'op-user-1',
          rotationCount: 0,
        }),
      })
    );
  });

  it('returns different families on consecutive calls', async () => {
    mockPrisma.operatorSession.create.mockResolvedValue(makeSession());

    const r1 = await issueOperatorSession('op-user-1', false, 'op-org-1');
    const r2 = await issueOperatorSession('op-user-1', false, 'op-org-1');

    expect(r1.family).not.toBe(r2.family);
  });
});

// ---------------------------------------------------------------------------
// rotateOperatorRefresh
// ---------------------------------------------------------------------------

describe('rotateOperatorRefresh', () => {
  it('rotates a valid non-revoked session', async () => {
    const session = makeSession({ rotationCount: 2 });
    mockPrisma.operatorSession.findUnique.mockResolvedValue(session);
    mockPrisma.operatorSession.update.mockResolvedValue({ ...session, revokedAt: new Date() });
    mockPrisma.operatorSession.create.mockResolvedValue(makeSession({ rotationCount: 3 }));

    const result = await rotateOperatorRefresh('old-hash', false, 'op-org-1');

    expect(result).not.toHaveProperty('reuse');
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');

    // Should revoke old session
    expect(mockPrisma.operatorSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: session.id },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      })
    );

    // Should create new session with incremented rotation
    expect(mockPrisma.operatorSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operatorUserId: session.operatorUserId,
          rotationCount: 3,
        }),
      })
    );
  });

  it('returns { reuse: true } and revokes entire family on already-revoked token', async () => {
    const session = makeSession({ revokedAt: new Date(Date.now() - 1000) });
    mockPrisma.operatorSession.findUnique.mockResolvedValue(session);
    mockPrisma.operatorSession.updateMany.mockResolvedValue({ count: 2 });

    const result = await rotateOperatorRefresh('revoked-hash');

    expect(result).toEqual({ reuse: true });

    // Should revoke entire family
    expect(mockPrisma.operatorSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenFamily: session.tokenFamily },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      })
    );
  });

  it('throws SESSION_NOT_FOUND when hash does not exist', async () => {
    mockPrisma.operatorSession.findUnique.mockResolvedValue(null);

    await expect(rotateOperatorRefresh('ghost-hash')).rejects.toThrow('SESSION_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// revokeOperatorSession
// ---------------------------------------------------------------------------

describe('revokeOperatorSession', () => {
  it('soft-deletes the session by refreshHash', async () => {
    mockPrisma.operatorSession.update.mockResolvedValue(makeSession());

    await revokeOperatorSession('some-hash');

    expect(mockPrisma.operatorSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { refreshTokenHash: 'some-hash' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      })
    );
  });

  it('is idempotent — swallows not-found errors', async () => {
    mockPrisma.operatorSession.update.mockRejectedValue(new Error('not found'));

    await expect(revokeOperatorSession('ghost-hash')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// revokeAllOperatorSessions
// ---------------------------------------------------------------------------

describe('revokeAllOperatorSessions', () => {
  it('updates all sessions for the given operator', async () => {
    mockPrisma.operatorSession.updateMany.mockResolvedValue({ count: 3 });

    await revokeAllOperatorSessions('op-user-1');

    expect(mockPrisma.operatorSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ operatorUserId: 'op-user-1' }),
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      })
    );
  });

  it('can optionally exclude a specific session', async () => {
    mockPrisma.operatorSession.updateMany.mockResolvedValue({ count: 2 });

    await revokeAllOperatorSessions('op-user-1', 'exclude-sess-id');

    expect(mockPrisma.operatorSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          operatorUserId: 'op-user-1',
          NOT: { id: 'exclude-sess-id' },
        }),
      })
    );
  });
});
