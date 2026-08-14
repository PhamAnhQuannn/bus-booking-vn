/**
 * Unit tests for lib/auth/authService.ts
 * Prisma, session, otp, and password modules are all mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- hoisted mocks ----
const { mockPrisma, mockSession, mockConsume, mockHashPassword, mockVerifyPassword, mockDummyVerify, mockNeedsRehash, mockVerifyRefreshToken, mockRotateRefresh, mockRevokeSession } = vi.hoisted(() => {
  const mockPrisma = {
    customer: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    booking: {
      // needed by backfillGuestBookingsForCustomer inside register $transaction
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    // #472: recordRegistrationConsent writes two rows inside the register $transaction.
    customerConsent: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    // Transaction: execute the callback with the same mock object (so customer.create mock is used)
    $transaction: vi.fn(),
  };
  const mockSession = {
    createSession: vi.fn(),
  };
  const mockConsume = vi.fn();
  const mockHashPassword = vi.fn();
  const mockVerifyPassword = vi.fn();
  const mockDummyVerify = vi.fn();
  const mockNeedsRehash = vi.fn();
  const mockVerifyRefreshToken = vi.fn();
  const mockRotateRefresh = vi.fn();
  const mockRevokeSession = vi.fn();
  return { mockPrisma, mockSession, mockConsume, mockHashPassword, mockVerifyPassword, mockDummyVerify, mockNeedsRehash, mockVerifyRefreshToken, mockRotateRefresh, mockRevokeSession };
});

vi.mock('@/lib/core/db/client', () => ({ prisma: mockPrisma }));
vi.mock('../session', () => ({
  createSession: mockSession.createSession,
  rotateRefresh: mockRotateRefresh,
  revokeSession: mockRevokeSession,
}));
vi.mock('../otp', () => ({ consume: mockConsume }));
vi.mock('../password', () => ({
  hash: mockHashPassword,
  verify: mockVerifyPassword,
  dummyVerify: mockDummyVerify,
  needsRehash: mockNeedsRehash,
}));
vi.mock('../refreshToken', () => ({ verify: mockVerifyRefreshToken }));

import { register, login, verifyOtp, refresh, logout, AuthServiceError } from '../authService';

const SESSION_STUB = {
  access: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  refreshHash: 'mock-refresh-hash',
  csrf: 'mock-csrf',
  family: 'mock-family',
};

const CUSTOMER_STUB = {
  id: 'cust-001',
  email: 'test@example.com',
  displayName: 'Test User',
  suspendedAt: null,
  // #492: login now requires a proven email; register() stamps this in the same tx.
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockHashPassword.mockResolvedValue('hashed-password');
  mockVerifyPassword.mockResolvedValue(true);
  mockDummyVerify.mockResolvedValue(undefined);
  // Mirror the real needsRehash: a non-argon2id hash should be upgraded.
  mockNeedsRehash.mockImplementation((h: string) => !String(h).startsWith('$argon2'));
  mockSession.createSession.mockResolvedValue(SESSION_STUB);
  mockPrisma.customer.update.mockResolvedValue({});
  mockPrisma.booking.updateMany.mockResolvedValue({ count: 0 });
  // Execute transaction callback using mockPrisma itself as tx, so customer.create mock is used
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockPrisma));
});

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------
describe('authService.register', () => {
  it('creates customer and returns authResult on success', async () => {
    mockPrisma.customer.create.mockResolvedValue(CUSTOMER_STUB);

    const result = await register({ email: 'test@example.com', password: 'Password1' });
    expect(result.accessToken).toBe('mock-access-token');
    expect(result.customer.email).toBe(CUSTOMER_STUB.email);
  });

  it('records ToS + privacy consent rows in the register transaction (#472)', async () => {
    mockPrisma.customer.create.mockResolvedValue(CUSTOMER_STUB);
    await register({ email: 'test@example.com', password: 'Password1' });
    expect(mockPrisma.customerConsent.createMany).toHaveBeenCalledWith({
      data: [
        { customerId: CUSTOMER_STUB.id, consentType: 'tos', version: expect.any(String) },
        { customerId: CUSTOMER_STUB.id, consentType: 'privacy', version: expect.any(String) },
      ],
    });
  });

  it('forwards the session context (ip/userAgent) to createSession (#477)', async () => {
    mockPrisma.customer.create.mockResolvedValue(CUSTOMER_STUB);
    await register({ email: 'test@example.com', password: 'Password1' }, { ip: '203.0.113.5', userAgent: 'UA/1' });
    expect(mockSession.createSession).toHaveBeenCalledWith(
      CUSTOMER_STUB.id,
      { ip: '203.0.113.5', userAgent: 'UA/1' },
    );
  });

  it('lowercases email before create', async () => {
    mockPrisma.customer.create.mockResolvedValue(CUSTOMER_STUB);
    await register({ email: 'Test@Example.COM', password: 'Password1' });
    expect(mockPrisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'test@example.com' }),
      })
    );
  });

  it('stamps emailVerifiedAt on create (email proven via OTP proof upstream — P13)', async () => {
    mockPrisma.customer.create.mockResolvedValue(CUSTOMER_STUB);
    await register({ email: 'test@example.com', password: 'Password1' });
    const arg = mockPrisma.customer.create.mock.calls[0][0] as {
      data: { emailVerifiedAt: unknown };
    };
    expect(arg.data.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('throws EMAIL_TAKEN on Prisma P2002 unique constraint', async () => {
    const { Prisma } = await import('@prisma/client');
    const realErr = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '7.0.0',
    });
    mockPrisma.customer.create.mockRejectedValue(realErr);

    await expect(register({ email: 'test@example.com', password: 'Password1' })).rejects.toThrow(AuthServiceError);
    await expect(register({ email: 'test@example.com', password: 'Password1' })).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });
});

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------
describe('authService.login', () => {
  it('returns authResult on correct credentials', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      ...CUSTOMER_STUB,
      passwordHash: 'hash',
    });

    const result = await login({ email: 'test@example.com', password: 'Password1' });
    expect(result.accessToken).toBe('mock-access-token');
  });

  it('throws INVALID_CREDENTIALS for wrong password', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      ...CUSTOMER_STUB,
      passwordHash: 'hash',
    });
    mockVerifyPassword.mockResolvedValue(false);

    await expect(login({ email: 'test@example.com', password: 'wrong' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('throws INVALID_CREDENTIALS and runs dummyVerify for nonexistent email', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue(null);

    await expect(login({ email: 'test@example.com', password: 'whatever' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(mockDummyVerify).toHaveBeenCalledTimes(1);
  });

  it('throws INVALID_CREDENTIALS when passwordHash is null', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      ...CUSTOMER_STUB,
      passwordHash: null,
    });

    await expect(login({ email: 'test@example.com', password: 'whatever' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(mockDummyVerify).toHaveBeenCalledTimes(1);
  });

  it('#492: throws INVALID_CREDENTIALS + dummyVerify for an unverified email, mints no session', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      ...CUSTOMER_STUB,
      passwordHash: 'hash',
      emailVerifiedAt: null, // has a password but email never proven — must not log in
    });

    await expect(
      login({ email: 'test@example.com', password: 'Password1' })
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(mockDummyVerify).toHaveBeenCalledTimes(1);
    expect(mockSession.createSession).not.toHaveBeenCalled();
  });

  it('throws INVALID_CREDENTIALS + dummyVerify for a suspended customer, mints no session (P8)', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      ...CUSTOMER_STUB,
      passwordHash: 'hash',
      suspendedAt: new Date(),
    });

    await expect(
      login({ email: 'test@example.com', password: 'Password1' })
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(mockDummyVerify).toHaveBeenCalledTimes(1);
    expect(mockSession.createSession).not.toHaveBeenCalled();
  });

  it('upgrades a legacy scrypt hash to argon2 on successful login (rehash-on-verify, P19)', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({ ...CUSTOMER_STUB, passwordHash: 'scrypt$legacy' });
    mockHashPassword.mockResolvedValue('$argon2id$v=19$upgraded');

    await login({ email: 'test@example.com', password: 'Password1' });

    expect(mockPrisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: '$argon2id$v=19$upgraded' }),
      })
    );
  });

  it('does NOT rewrite passwordHash when the stored hash is already argon2 (P19)', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({ ...CUSTOMER_STUB, passwordHash: '$argon2id$existing' });

    await login({ email: 'test@example.com', password: 'Password1' });

    const updateArg = mockPrisma.customer.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateArg.data.passwordHash).toBeUndefined();
    expect(mockHashPassword).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// verifyOtp
// ---------------------------------------------------------------------------
describe('authService.verifyOtp', () => {
  it('returns ok when consume returns ok', async () => {
    mockConsume.mockResolvedValue({ status: 'ok', otpId: 'otp-1' });
    const result = await verifyOtp('test@example.com', '123456');
    expect(result.status).toBe('ok');
  });

  it('returns mismatch when consume returns mismatch', async () => {
    mockConsume.mockResolvedValue({ status: 'mismatch' });
    const result = await verifyOtp('test@example.com', '000000');
    expect(result.status).toBe('mismatch');
  });

  it('returns gone when consume returns gone', async () => {
    mockConsume.mockResolvedValue({ status: 'gone' });
    const result = await verifyOtp('test@example.com', '000000');
    expect(result.status).toBe('gone');
  });

  it('passes normalized email to consume', async () => {
    mockConsume.mockResolvedValue({ status: 'ok' });
    await verifyOtp('Test@Example.COM', '123456');
    expect(mockConsume).toHaveBeenCalledWith('test@example.com', '123456');
  });
});

// ---------------------------------------------------------------------------
// refresh
// ---------------------------------------------------------------------------
describe('authService.refresh', () => {
  it('returns new tokens + rehydrated displayName/email on valid refresh (F1)', async () => {
    mockVerifyRefreshToken.mockReturnValue({ payload: {}, hash: 'old-hash' });
    mockRotateRefresh.mockResolvedValue({
      access: 'new-access',
      refreshToken: 'new-refresh',
      refreshHash: 'new-hash',
      csrf: 'new-csrf',
      customerId: 'cust-1',
    });
    mockPrisma.customer.findFirst.mockResolvedValue({
      displayName: 'Test User',
      email: 'test@example.com',
    });

    const result = await refresh('valid-token');
    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    // F1: the refresh response carries the owner's name/email so a hard reload restores them.
    expect(result.displayName).toBe('Test User');
    expect(result.email).toBe('test@example.com');
    expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'cust-1', deletedAt: null }) })
    );
  });

  it('throws REFRESH_INVALID when token is malformed', async () => {
    mockVerifyRefreshToken.mockReturnValue(null);
    await expect(refresh('bad-token')).rejects.toMatchObject({ code: 'REFRESH_INVALID' });
  });

  it('throws SESSION_REUSE when rotateRefresh detects reuse', async () => {
    mockVerifyRefreshToken.mockReturnValue({ payload: {}, hash: 'old-hash' });
    mockRotateRefresh.mockResolvedValue({ reuse: true });
    await expect(refresh('reused-token')).rejects.toMatchObject({ code: 'SESSION_REUSE' });
  });
});

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------
describe('authService.logout', () => {
  it('revokes session for valid token', async () => {
    mockVerifyRefreshToken.mockReturnValue({ payload: {}, hash: 'hash-abc' });
    mockRevokeSession.mockResolvedValue(undefined);

    await logout('valid-token');
    expect(mockRevokeSession).toHaveBeenCalledWith('hash-abc');
  });

  it('does nothing for invalid token (no throw)', async () => {
    mockVerifyRefreshToken.mockReturnValue(null);
    await expect(logout('bad-token')).resolves.toBeUndefined();
    expect(mockRevokeSession).not.toHaveBeenCalled();
  });
});
