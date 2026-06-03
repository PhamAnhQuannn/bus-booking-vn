/**
 * Unit tests for the storage layer (Issue 059).
 *
 * Mock-prisma + env driven (process.env + _resetEnvCache so getEnv re-parses).
 * Covers: createSignedUploadUrl validates content-type + size, persists a
 * StoredObject row, returns a signed stub PUT URL; createSignedDownloadUrl mints
 * a GET URL + audits kyb_doc but NOT ticket_pdf + throws not_found; verifyStubSignature
 * round-trips a fresh sig and rejects tampered/expired; real mode (STORAGE_STUB=false)
 * throws s3_not_implemented on both mint paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/config/env', () => ({ getEnv: vi.fn() }));

import {
  createSignedUploadUrl,
  createSignedDownloadUrl,
  verifyStubSignature,
  type StorageClient,
  type StoredObjectRow,
} from '..';
import { getEnv } from '@/lib/config/env';

const STUB_SECRET = 'unit-test-storage-secret-0123456789';

function makePrisma(seed?: StoredObjectRow | null) {
  const storedObject = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'so_1',
      createdAt: new Date(),
      uploadedBy: null,
      ...data,
    })),
    findUnique: vi.fn(async () => seed ?? null),
  };
  const adminAuditLog = {
    create: vi.fn(async (_args: { data: Record<string, unknown> }) => ({})),
  };
  return { storedObject, adminAuditLog } as unknown as StorageClient & {
    storedObject: typeof storedObject;
    adminAuditLog: typeof adminAuditLog;
  };
}

function setStub(on: boolean) {
  vi.mocked(getEnv).mockReturnValue({
    STORAGE_STUB: on,
    STORAGE_STUB_SECRET: STUB_SECRET,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  setStub(true);
});
afterEach(() => vi.clearAllMocks());

describe('createSignedUploadUrl', () => {
  it('rejects a disallowed content type for the purpose', async () => {
    const prisma = makePrisma();
    await expect(
      createSignedUploadUrl(prisma, {
        purpose: 'ticket_pdf',
        contentType: 'image/png',
        sizeBytes: 1000,
      })
    ).rejects.toMatchObject({ code: 'invalid_content_type' });
    expect(prisma.storedObject.create).not.toHaveBeenCalled();
  });

  it('rejects an over-size upload', async () => {
    const prisma = makePrisma();
    await expect(
      createSignedUploadUrl(prisma, {
        purpose: 'ticket_pdf',
        contentType: 'application/pdf',
        sizeBytes: 6 * 1024 * 1024, // > 5MB ticket_pdf cap
      })
    ).rejects.toMatchObject({ code: 'too_large' });
    expect(prisma.storedObject.create).not.toHaveBeenCalled();
  });

  it('rejects a non-positive / non-integer size', async () => {
    const prisma = makePrisma();
    await expect(
      createSignedUploadUrl(prisma, {
        purpose: 'kyb_doc',
        contentType: 'application/pdf',
        sizeBytes: 0,
      })
    ).rejects.toMatchObject({ code: 'too_large' });
  });

  it('persists a StoredObject row and returns a signed stub PUT URL', async () => {
    const prisma = makePrisma();
    const result = await createSignedUploadUrl(prisma, {
      purpose: 'kyb_doc',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      uploadedBy: 'op_42',
      keyHint: 'My License!.pdf',
      baseUrl: 'http://localhost:3001',
    });

    expect(prisma.storedObject.create).toHaveBeenCalledTimes(1);
    const data = prisma.storedObject.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      key: result.key,
      contentType: 'application/pdf',
      sizeBytes: 2048,
      purpose: 'kyb_doc',
      uploadedBy: 'op_42',
    });

    expect(result.key).toMatch(/^kyb_doc\/[0-9a-f-]{36}\/My-License-.pdf$/);
    expect(result.uploadUrl).toContain('/dev/stub-storage/');
    expect(result.uploadUrl).toMatch(/[?&]exp=\d+/);
    expect(result.uploadUrl).toMatch(/[?&]sig=[0-9a-f]{64}/);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('throws s3_not_implemented in real mode (after persisting the row)', async () => {
    setStub(false);
    const prisma = makePrisma();
    await expect(
      createSignedUploadUrl(prisma, {
        purpose: 'kyb_doc',
        contentType: 'image/jpeg',
        sizeBytes: 1234,
      })
    ).rejects.toMatchObject({ code: 's3_not_implemented' });
  });
});

describe('createSignedDownloadUrl', () => {
  const kybRow: StoredObjectRow = {
    id: 'so_kyb',
    key: 'kyb_doc/abc/license.pdf',
    contentType: 'application/pdf',
    sizeBytes: 2048,
    purpose: 'kyb_doc',
    uploadedBy: 'op_42',
    createdAt: new Date(),
  };
  const ticketRow: StoredObjectRow = {
    ...kybRow,
    id: 'so_ticket',
    key: 'ticket_pdf/xyz/ticket.pdf',
    purpose: 'ticket_pdf',
    uploadedBy: null,
  };

  it('throws not_found when the object is absent', async () => {
    const prisma = makePrisma(null);
    await expect(
      createSignedDownloadUrl(prisma, 'kyb_doc/missing', { actor: 'admin_1' })
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('mints a signed GET URL and audits a kyb_doc (PII) access', async () => {
    const prisma = makePrisma(kybRow);
    const result = await createSignedDownloadUrl(prisma, kybRow.key, {
      actor: 'admin_1',
      baseUrl: 'http://localhost:3001',
    });

    expect(result.downloadUrl).toContain('/dev/stub-storage/');
    expect(result.downloadUrl).toMatch(/[?&]sig=[0-9a-f]{64}/);
    expect(prisma.adminAuditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.adminAuditLog.create.mock.calls[0][0].data).toMatchObject({
      actor: 'admin_1',
      action: 'storage-access',
      target: kybRow.key,
      argsRedacted: JSON.stringify({ purpose: 'kyb_doc' }),
    });
  });

  it('does NOT audit a ticket_pdf (non-PII) access', async () => {
    const prisma = makePrisma(ticketRow);
    await createSignedDownloadUrl(prisma, ticketRow.key, { actor: 'sys' });
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('throws s3_not_implemented in real mode', async () => {
    setStub(false);
    const prisma = makePrisma(ticketRow);
    await expect(
      createSignedDownloadUrl(prisma, ticketRow.key, { actor: 'sys' })
    ).rejects.toMatchObject({ code: 's3_not_implemented' });
  });
});

describe('verifyStubSignature', () => {
  it('accepts a freshly-minted signature for the round-trip', async () => {
    const prisma = makePrisma();
    const { key, uploadUrl } = await createSignedUploadUrl(prisma, {
      purpose: 'kyb_doc',
      contentType: 'application/pdf',
      sizeBytes: 1000,
      baseUrl: 'http://localhost:3001',
    });
    const url = new URL(uploadUrl);
    const exp = Number(url.searchParams.get('exp'));
    const sig = url.searchParams.get('sig') as string;
    expect(verifyStubSignature(key, 'PUT', exp, sig)).toBe(true);
  });

  it('rejects a tampered signature', async () => {
    const prisma = makePrisma();
    const { key, uploadUrl } = await createSignedUploadUrl(prisma, {
      purpose: 'kyb_doc',
      contentType: 'application/pdf',
      sizeBytes: 1000,
    });
    const url = new URL(uploadUrl);
    const exp = Number(url.searchParams.get('exp'));
    const sig = url.searchParams.get('sig') as string;
    const tampered = sig.slice(0, -2) + (sig.endsWith('00') ? '11' : '00');
    expect(verifyStubSignature(key, 'PUT', exp, tampered)).toBe(false);
  });

  it('rejects a method mismatch (PUT sig presented as GET)', async () => {
    const prisma = makePrisma();
    const { key, uploadUrl } = await createSignedUploadUrl(prisma, {
      purpose: 'kyb_doc',
      contentType: 'application/pdf',
      sizeBytes: 1000,
    });
    const url = new URL(uploadUrl);
    const exp = Number(url.searchParams.get('exp'));
    const sig = url.searchParams.get('sig') as string;
    expect(verifyStubSignature(key, 'GET', exp, sig)).toBe(false);
  });

  it('rejects an expired signature', async () => {
    const prisma = makePrisma();
    const { key, uploadUrl } = await createSignedUploadUrl(prisma, {
      purpose: 'kyb_doc',
      contentType: 'application/pdf',
      sizeBytes: 1000,
    });
    const url = new URL(uploadUrl);
    const exp = Number(url.searchParams.get('exp'));
    const sig = url.searchParams.get('sig') as string;
    // now is AFTER exp → expired.
    expect(verifyStubSignature(key, 'PUT', exp, sig, exp + 1)).toBe(false);
  });
});
