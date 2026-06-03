/**
 * Issue 077: unit tests for POST /api/op/kyb/upload-url.
 *
 * Mocks the operator-auth dependencies (jwt + prisma.operatorUser + cookies) the
 * same way the other op route tests do, and stubs requestKybUploadUrl. Covers:
 *   - 401 without an operator session
 *   - 400 on invalid body shape
 *   - 200 happy path returns { uploadUrl, key, kybDocumentId }, operatorId from JWT
 *   - 422 INVALID_TYPE (KybError)
 *   - 422 INVALID_CONTENT_TYPE / TOO_LARGE (StorageError)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockCookieStore,
  mockRequestKybUploadUrl,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockCookieStore: { get: vi.fn() },
  mockRequestKybUploadUrl: vi.fn(),
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));
vi.mock('@/lib/core/db/client', () => ({
  prisma: { operatorUser: { findUnique: mockOperatorFindUnique } },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('@/lib/onboarding/kyb', async () => {
  const actual = await vi.importActual<typeof import('@/lib/onboarding/kyb')>(
    '@/lib/onboarding/kyb'
  );
  return { ...actual, requestKybUploadUrl: mockRequestKybUploadUrl };
});

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { KybError } from '@/lib/onboarding/kyb';
import { StorageError } from '@/lib/storage';

const OPERATOR_USER = {
  id: 'op-user-1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  role: 'admin' as const,
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: 'op-org-A',
  assignedTripId: null,
};

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/op/kyb/upload-url', {
    method: 'POST',
    headers: { Cookie: 'bb_op_access=valid-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({
    sub: 'op-user-1',
    scope: 'operator',
    requiresPasswordChange: false,
    operatorId: 'op-org-A',
    role: 'admin',
  });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_USER);
  mockRequestKybUploadUrl.mockResolvedValue({
    uploadUrl: 'http://localhost:3001/dev/stub-storage/kyb_doc/x?exp=1&sig=a',
    key: 'kyb_doc/x/identity',
    kybDocumentId: 'kyb_1',
  });
});

describe('POST /api/op/kyb/upload-url', () => {
  it('401 without an operator session cookie', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makePost({ type: 'identity', contentType: 'image/png', sizeBytes: 10 }));
    expect(res.status).toBe(401);
  });

  it('400 on invalid body shape', async () => {
    const res = await POST(makePost({ type: 'identity' }));
    expect(res.status).toBe(400);
  });

  it('200 happy path, passes ctx.operatorId (from JWT) to the service', async () => {
    const res = await POST(
      makePost({ type: 'identity', contentType: 'image/png', sizeBytes: 2048 })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      uploadUrl: 'http://localhost:3001/dev/stub-storage/kyb_doc/x?exp=1&sig=a',
      key: 'kyb_doc/x/identity',
      kybDocumentId: 'kyb_1',
    });
    expect(mockRequestKybUploadUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ operatorId: 'op-org-A', type: 'identity' })
    );
  });

  it('422 INVALID_TYPE on KybError', async () => {
    mockRequestKybUploadUrl.mockRejectedValueOnce(new KybError('invalid_type'));
    const res = await POST(
      makePost({ type: 'passport', contentType: 'image/png', sizeBytes: 10 })
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('INVALID_TYPE');
  });

  it('422 INVALID_CONTENT_TYPE on StorageError(invalid_content_type)', async () => {
    mockRequestKybUploadUrl.mockRejectedValueOnce(new StorageError('invalid_content_type'));
    const res = await POST(
      makePost({ type: 'identity', contentType: 'text/plain', sizeBytes: 10 })
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('INVALID_CONTENT_TYPE');
  });

  it('422 TOO_LARGE on StorageError(too_large)', async () => {
    mockRequestKybUploadUrl.mockRejectedValueOnce(new StorageError('too_large'));
    const res = await POST(
      makePost({ type: 'identity', contentType: 'image/png', sizeBytes: 99_999_999 })
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('TOO_LARGE');
  });
});
