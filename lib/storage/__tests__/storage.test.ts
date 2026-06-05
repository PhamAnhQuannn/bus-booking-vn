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
  putObject,
  deleteObject,
  verifyStubSignature,
  type StorageClient,
  type StoredObjectRow,
} from '..';
import { getStubBlob } from '../stubStore';
import { getEnv } from '@/lib/config';

const STUB_SECRET = 'unit-test-storage-secret-0123456789';

function makePrisma(seed?: StoredObjectRow | null) {
  // In-memory row store so an upsert is visible to a subsequent findUnique
  // (exercises the putObject → signed-download round-trip on the row side).
  const rows = new Map<string, StoredObjectRow>();
  if (seed) rows.set(seed.key, seed);
  const storedObject = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'so_1',
      createdAt: new Date(),
      uploadedBy: null,
      ...data,
    })),
    findUnique: vi.fn(async ({ where }: { where: { key: string } }) => rows.get(where.key) ?? null),
    upsert: vi.fn(
      async ({
        where,
        create,
      }: {
        where: { key: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const row = {
          id: 'so_up',
          createdAt: new Date(),
          uploadedBy: null,
          ...create,
        } as unknown as StoredObjectRow;
        rows.set(where.key, row);
        return row;
      }
    ),
    deleteMany: vi.fn(async ({ where }: { where: { key: string } }) => {
      const had = rows.delete(where.key);
      return { count: had ? 1 : 0 };
    }),
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

describe('putObject (server-side upload, Issue 074)', () => {
  it('round-trips: putObject stores bytes + a row; signed-download then mints a URL', async () => {
    const prisma = makePrisma();
    const key = 'ticket_pdf/BB-2026-abcd-efgh.pdf';
    const bytes = Buffer.from('%PDF-1.4 fake ticket bytes');

    await putObject(prisma, key, 'application/pdf', bytes);

    // Pointer row upserted (so the download/audit path finds it).
    expect(prisma.storedObject.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.storedObject.upsert.mock.calls[0][0]).toMatchObject({
      where: { key },
      create: { key, contentType: 'application/pdf', purpose: 'ticket_pdf' },
    });

    // Bytes landed in the SHARED stub store (same Map the GET route reads).
    const blob = getStubBlob(key);
    expect(blob?.bytes.equals(bytes)).toBe(true);
    expect(blob?.contentType).toBe('application/pdf');

    // A signed download URL can now be minted for the putObject-created key.
    const { downloadUrl } = await createSignedDownloadUrl(prisma, key, {
      actor: 'customer:c1',
      baseUrl: 'http://localhost:3001',
    });
    expect(downloadUrl).toContain('/dev/stub-storage/ticket_pdf/');
    expect(downloadUrl).toMatch(/[?&]sig=[0-9a-f]{64}/);
  });

  it('accepts a Uint8Array and derives sizeBytes from the buffer length', async () => {
    const prisma = makePrisma();
    const key = 'ticket_pdf/BB-2026-wxyz-1234.pdf';
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);

    await putObject(prisma, key, 'application/pdf', bytes);

    expect(prisma.storedObject.upsert.mock.calls[0][0].create).toMatchObject({
      sizeBytes: 5,
    });
    expect(getStubBlob(key)?.bytes.length).toBe(5);
  });

  it('throws s3_not_implemented in real mode (after upserting the row)', async () => {
    setStub(false);
    const prisma = makePrisma();
    await expect(
      putObject(prisma, 'ticket_pdf/real.pdf', 'application/pdf', Buffer.from('x'))
    ).rejects.toMatchObject({ code: 's3_not_implemented' });
    expect(prisma.storedObject.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('deleteObject (retention purge, Issue 090)', () => {
  it('removes the blob from the shared store + the pointer row; download then 404s', async () => {
    const prisma = makePrisma();
    const key = 'kyb_doc/del/license.pdf';
    const bytes = Buffer.from('%PDF-1.4 doomed kyb doc');

    await putObject(prisma, key, 'application/pdf', bytes);
    expect(getStubBlob(key)?.bytes.equals(bytes)).toBe(true);

    await deleteObject(prisma, key);

    // Blob gone from the shared stub store.
    expect(getStubBlob(key)).toBeUndefined();
    // Pointer row deleted.
    expect(prisma.storedObject.deleteMany).toHaveBeenCalledWith({ where: { key } });
    // A subsequent signed-download no longer finds the object.
    await expect(
      createSignedDownloadUrl(prisma, key, { actor: 'cron:retention-sweep' })
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('is idempotent on an absent key (no throw, deleteMany count 0)', async () => {
    const prisma = makePrisma();
    await expect(deleteObject(prisma, 'kyb_doc/never/existed')).resolves.toBeUndefined();
    expect(prisma.storedObject.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('throws s3_not_implemented in real mode (no row deleted)', async () => {
    setStub(false);
    const prisma = makePrisma();
    await expect(deleteObject(prisma, 'kyb_doc/x/y.pdf')).rejects.toMatchObject({
      code: 's3_not_implemented',
    });
    expect(prisma.storedObject.deleteMany).not.toHaveBeenCalled();
  });
});
