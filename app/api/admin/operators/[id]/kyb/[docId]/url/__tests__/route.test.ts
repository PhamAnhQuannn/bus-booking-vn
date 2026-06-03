/**
 * Issue 077: unit tests for GET /api/admin/operators/[id]/kyb/[docId]/url.
 *
 * Mocks requireAdminAuth as a passthrough injecting a SUPER_ADMIN ctx (the real
 * role+TOTP gate is unit-tested in requireAdminAuth's own module), prisma.
 * kybDocument.findUnique, and createSignedDownloadUrl. Covers:
 *   - 200 { url } on a doc that belongs to the operator; createSignedDownloadUrl
 *     called with the storageKey + admin actor (which audits the kyb_doc access)
 *   - 404 when the doc does not exist
 *   - 404 when the doc belongs to a DIFFERENT operator (belongs-to check)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUnique, mockCreateSignedDownloadUrl } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreateSignedDownloadUrl: vi.fn(),
}));

vi.mock('@/lib/auth/requireAdminAuth', () => ({
  requireAdminAuth:
    () => (handler: (req: unknown, ctx: unknown) => Promise<Response>) => (req: unknown) =>
      handler(req, { adminId: 'super-1', role: 'SUPER_ADMIN', totpVerified: true }),
}));
vi.mock('@/lib/db/client', () => ({
  prisma: { kybDocument: { findUnique: mockFindUnique } },
}));
vi.mock('@/lib/storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage')>('@/lib/storage');
  return { ...actual, createSignedDownloadUrl: mockCreateSignedDownloadUrl };
});

import { GET } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(operatorId = 'op_1', docId = 'kyb_1'): NextRequest {
  return new NextRequest(
    `http://localhost/api/admin/operators/${operatorId}/kyb/${docId}/url`,
    { method: 'GET' }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateSignedDownloadUrl.mockResolvedValue({
    downloadUrl: 'http://localhost:3001/dev/stub-storage/kyb_doc/x?exp=1&sig=g',
    expiresAt: new Date(),
  });
});

describe('GET /api/admin/operators/[id]/kyb/[docId]/url', () => {
  it('200 { url } for a doc that belongs to the operator; audits via storage actor', async () => {
    mockFindUnique.mockResolvedValue({
      operatorId: 'op_1',
      storageKey: 'kyb_doc/x/identity',
    });
    const res = await GET(makeRequest('op_1', 'kyb_1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: 'http://localhost:3001/dev/stub-storage/kyb_doc/x?exp=1&sig=g',
    });
    expect(mockCreateSignedDownloadUrl).toHaveBeenCalledWith(
      expect.anything(),
      'kyb_doc/x/identity',
      { actor: 'admin:super-1' }
    );
  });

  it('404 when the doc does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await GET(makeRequest('op_1', 'missing'));
    expect(res.status).toBe(404);
    expect(mockCreateSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('404 when the doc belongs to a different operator (belongs-to check)', async () => {
    mockFindUnique.mockResolvedValue({
      operatorId: 'op_OTHER',
      storageKey: 'kyb_doc/y/identity',
    });
    const res = await GET(makeRequest('op_1', 'kyb_1'));
    expect(res.status).toBe(404);
    expect(mockCreateSignedDownloadUrl).not.toHaveBeenCalled();
  });
});
