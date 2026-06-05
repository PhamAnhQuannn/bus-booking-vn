/**
 * Integration tests for the storage layer (Issue 059) — real DB.
 * Requires DATABASE_URL (run via `pnpm vitest:int`).
 *
 * Covers: createSignedUploadUrl persists a real StoredObject row;
 * createSignedDownloadUrl for a kyb_doc writes a real AdminAuditLog row.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { _resetEnvCache } from '@/lib/config/env';
import { createSignedUploadUrl, createSignedDownloadUrl, type StorageClient } from '..';

const db = prisma as unknown as StorageClient;
const createdKeys: string[] = [];
const AUDIT_TARGETS: string[] = [];

beforeAll(() => {
  process.env.STORAGE_STUB = 'true';
  process.env.STORAGE_STUB_SECRET = 'int-test-storage-secret-0123456789';
  _resetEnvCache();
});

afterAll(async () => {
  if (createdKeys.length) {
    await prisma.storedObject.deleteMany({ where: { key: { in: createdKeys } } });
  }
  if (AUDIT_TARGETS.length) {
    // AdminAuditLog is append-only (immutability trigger, Issue 062) — drop the
    // DELETE trigger to clean up this test's own audit rows, then recreate it.
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "admin_audit_log_no_delete" ON "AdminAuditLog"');
    await prisma.adminAuditLog.deleteMany({
      where: { action: 'storage-access', target: { in: AUDIT_TARGETS } },
    });
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER "admin_audit_log_no_delete" BEFORE DELETE ON "AdminAuditLog" FOR EACH ROW EXECUTE FUNCTION "admin_audit_log_immutable"()'
    );
  }
});

describe('storage integration', () => {
  it('createSignedUploadUrl persists a real StoredObject row', async () => {
    const result = await createSignedUploadUrl(db, {
      purpose: 'kyb_doc',
      contentType: 'application/pdf',
      sizeBytes: 4096,
      uploadedBy: 'op_int_test',
    });
    createdKeys.push(result.key);

    const row = await prisma.storedObject.findUnique({ where: { key: result.key } });
    expect(row).not.toBeNull();
    expect(row).toMatchObject({
      contentType: 'application/pdf',
      sizeBytes: 4096,
      purpose: 'kyb_doc',
      uploadedBy: 'op_int_test',
    });
    expect(result.uploadUrl).toContain('/dev/stub-storage/');
  });

  it('createSignedDownloadUrl for a kyb_doc writes an AdminAuditLog row', async () => {
    const uploaded = await createSignedUploadUrl(db, {
      purpose: 'kyb_doc',
      contentType: 'image/png',
      sizeBytes: 1024,
      uploadedBy: 'op_int_test',
    });
    createdKeys.push(uploaded.key);
    AUDIT_TARGETS.push(uploaded.key);

    const before = await prisma.adminAuditLog.count({
      where: { action: 'storage-access', target: uploaded.key },
    });
    expect(before).toBe(0);

    const dl = await createSignedDownloadUrl(db, uploaded.key, { actor: 'admin_int_test' });
    expect(dl.downloadUrl).toContain('/dev/stub-storage/');

    const audit = await prisma.adminAuditLog.findFirst({
      where: { action: 'storage-access', target: uploaded.key },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actor).toBe('admin_int_test');
    expect(audit?.argsRedacted).toBe(JSON.stringify({ purpose: 'kyb_doc' }));
  });
});
