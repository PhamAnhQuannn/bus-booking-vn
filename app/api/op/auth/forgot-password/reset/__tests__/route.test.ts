/**
 * Unit tests for POST /api/op/auth/forgot-password/reset
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyProof, mockHashPassword, mockOperatorFindUnique, mockOperatorUpdate, mockRevokeAll } = vi.hoisted(() => ({
  mockVerifyProof: vi.fn(),
  mockHashPassword: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockOperatorUpdate: vi.fn(),
  mockRevokeAll: vi.fn(),
}));

vi.mock('@/lib/auth/otpProof', () => ({ verifyOtpProof: mockVerifyProof }));
vi.mock('@/lib/auth/password', () => ({ hash: mockHashPassword }));
vi.mock('@/lib/auth/operatorSession', () => ({ revokeAllOperatorSessions: mockRevokeAll }));
vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    operatorUser: {
      findUnique: mockOperatorFindUnique,
      update: mockOperatorUpdate,
    },
  },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/op/auth/forgot-password/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyProof.mockResolvedValue({ phone: '+8490xxxxxx1' });
  mockHashPassword.mockResolvedValue('new-hash');
  mockOperatorFindUnique.mockResolvedValue({ id: 'op-1', disabledAt: null });
  mockOperatorUpdate.mockResolvedValue({});
  mockRevokeAll.mockResolvedValue(undefined);
});

describe('POST /api/op/auth/forgot-password/reset', () => {
  it('returns 204 on success', async () => {
    const res = await POST(makeRequest({ otpProof: 'valid-proof', newPassword: 'NewPass1' }));
    expect(res.status).toBe(204);
    expect(mockRevokeAll).toHaveBeenCalledWith('op-1');
  });

  it('returns 401 INVALID_PROOF for expired/invalid proof', async () => {
    mockVerifyProof.mockResolvedValue(null);
    const res = await POST(makeRequest({ otpProof: 'bad-proof', newPassword: 'NewPass1' }));
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBe('INVALID_PROOF');
  });

  it('returns 400 WEAK_PASSWORD for short newPassword', async () => {
    const res = await POST(makeRequest({ otpProof: 'valid-proof', newPassword: 'short' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('WEAK_PASSWORD');
  });

  it('revokes all sessions after successful reset', async () => {
    const res = await POST(makeRequest({ otpProof: 'valid-proof', newPassword: 'NewPass1' }));
    expect(res.status).toBe(204);
    expect(mockRevokeAll).toHaveBeenCalledWith('op-1');
  });
});
