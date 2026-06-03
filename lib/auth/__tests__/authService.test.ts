/**
 * Unit tests for lib/auth/authService.ts
 * Prisma, session, otp, and password modules are all mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- hoisted mocks ----
const { mockPrisma, mockSession, mockConsume, mockHashPassword, mockVerifyPassword, mockDummyVerify, mockVerifyRefreshToken, mockRotateRefresh, mockRevokeSession } = vi.hoisted(() => {
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
  const mockVerifyRefreshToken = vi.fn();
  const mockRotateRefresh = vi.fn();
  const mockRevokeSession = vi.fn();
  return { mockPrisma, mockSession, mockConsume, mockHashPassword, mockVerifyPassword, mockDummyVerify, mockVerifyRefreshToken, mockRotateRefresh, mockRevokeSession };
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
  phone: '0901234567', // local format — avoids gitleaks \+84[35789]\d{8}; mock stub value only
  displayName: 'Test User',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockHashPassword.mockResolvedValue('hashed-password');
  mockVerifyPassword.mockResolvedValue(true);
  mockDummyVerify.mockResolvedValue(undefined);
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

    const result = await register({ phone: '0901234567', password: 'Password1' });
    expect(result.accessToken).toBe('mock-access-token');
    expect(result.customer.phone).toBe(CUSTOMER_STUB.phone);
  });

  it('normalizes phone before create', async () => {
    mockPrisma.customer.create.mockResolvedValue(CUSTOMER_STUB);
    await register({ phone: '0901234567', password: 'Password1' });
    expect(mockPrisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '+84901234567' }),
      })
    );
  });

  it('throws PHONE_TAKEN on Prisma P2002 unique constraint', async () => {
    const prismaErr = Object.assign(new Error('Unique'), {
      code: 'P2002',
      name: 'PrismaClientKnownRequestError',
    });
    mockPrisma.customer.create.mockRejectedValue(prismaErr);

    // Need actual Prisma error class
    const { Prisma } = await import('@prisma/client');
    const realErr = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '7.0.0',
    });
    mockPrisma.customer.create.mockRejectedValue(realErr);

    await expect(register({ phone: '0901234567', password: 'Password1' })).rejects.toThrow(AuthServiceError);
    await expect(register({ phone: '0901234567', password: 'Password1' })).rejects.toMatchObject({ code: 'PHONE_TAKEN' });
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

    const result = await login({ phone: '0901234567', password: 'Password1' });
    expect(result.accessToken).toBe('mock-access-token');
  });

  it('throws INVALID_CREDENTIALS for wrong password', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      ...CUSTOMER_STUB,
      passwordHash: 'hash',
    });
    mockVerifyPassword.mockResolvedValue(false);

    await expect(login({ phone: '0901234567', password: 'wrong' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('throws INVALID_CREDENTIALS and runs dummyVerify for nonexistent phone', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue(null);

    await expect(login({ phone: '0901234567', password: 'whatever' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(mockDummyVerify).toHaveBeenCalledTimes(1);
  });

  it('throws INVALID_CREDENTIALS when passwordHash is null', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      ...CUSTOMER_STUB,
      passwordHash: null,
    });

    await expect(login({ phone: '0901234567', password: 'whatever' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(mockDummyVerify).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// verifyOtp
// ---------------------------------------------------------------------------
describe('authService.verifyOtp', () => {
  it('returns ok when consume returns ok', async () => {
    mockConsume.mockResolvedValue({ status: 'ok', otpId: 'otp-1' });
    const result = await verifyOtp('0901234567', '123456');
    expect(result.status).toBe('ok');
  });

  it('returns mismatch when consume returns mismatch', async () => {
    mockConsume.mockResolvedValue({ status: 'mismatch' });
    const result = await verifyOtp('0901234567', '000000');
    expect(result.status).toBe('mismatch');
  });

  it('returns gone when consume returns gone', async () => {
    mockConsume.mockResolvedValue({ status: 'gone' });
    const result = await verifyOtp('0901234567', '000000');
    expect(result.status).toBe('gone');
  });

  it('passes normalized phone to consume', async () => {
    mockConsume.mockResolvedValue({ status: 'ok' });
    await verifyOtp('0901234567', '123456');
    expect(mockConsume).toHaveBeenCalledWith('+84901234567', '123456');
  });
});

// ---------------------------------------------------------------------------
// refresh
// ---------------------------------------------------------------------------
describe('authService.refresh', () => {
  it('returns new tokens on valid refresh', async () => {
    mockVerifyRefreshToken.mockReturnValue({ payload: {}, hash: 'old-hash' });
    mockRotateRefresh.mockResolvedValue({
      access: 'new-access',
      refreshToken: 'new-refresh',
      refreshHash: 'new-hash',
      csrf: 'new-csrf',
    });

    const result = await refresh('valid-token');
    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
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
