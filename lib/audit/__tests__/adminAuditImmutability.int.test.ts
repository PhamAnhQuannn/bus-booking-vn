/**
 * Integration tests for AdminAuditLog DB-enforced immutability (Issue 062).
 *
 * The core AC: AdminAuditLog is append-only. The `admin_audit_log_immutable`
 * trigger (migration 20260602110000_admin_audit_immutable) blocks UPDATE and
 * DELETE at the DB, role-independently — mirrors the LedgerEntry trigger (047).
 * Inserts a row, then attempts a raw UPDATE and DELETE and asserts BOTH throw.
 *
 * DB-gated — does not run locally (no DB); runs in CI against a migrated DB.
 * Run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { writeAdminAuditLog } from '../adminAuditLog';

let rowId: string;
const ACTOR = 'int-test:062';

beforeAll(async () => {
  await writeAdminAuditLog(prisma, {
    actor: ACTOR,
    action: 'int-test-seed',
    target: 'audit-immutability',
    argsRedacted: JSON.stringify({ note: 'seed row' }),
  });
  const row = await prisma.adminAuditLog.findFirst({ where: { actor: ACTOR }, select: { id: true } });
  rowId = row!.id;
});

afterAll(async () => {
  // Raw DELETE is blocked by the trigger — drop the triggers to clean up, then
  // re-create them so the DB returns to its migrated state.
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "admin_audit_log_no_update" ON "AdminAuditLog"');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "admin_audit_log_no_delete" ON "AdminAuditLog"');
  await prisma.adminAuditLog.deleteMany({ where: { actor: ACTOR } });
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "admin_audit_log_no_update" BEFORE UPDATE ON "AdminAuditLog" FOR EACH ROW EXECUTE FUNCTION "admin_audit_log_immutable"()'
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "admin_audit_log_no_delete" BEFORE DELETE ON "AdminAuditLog" FOR EACH ROW EXECUTE FUNCTION "admin_audit_log_immutable"()'
  );
  await prisma.$disconnect();
});

describe('AdminAuditLog immutability (DB trigger)', () => {
  it('blocks UPDATE on an existing audit row', async () => {
    await expect(
      prisma.$executeRaw`UPDATE "AdminAuditLog" SET "action" = 'tampered' WHERE "id" = ${rowId}`
    ).rejects.toThrow(/append-only/i);
  });

  it('blocks DELETE on an existing audit row', async () => {
    await expect(
      prisma.$executeRaw`DELETE FROM "AdminAuditLog" WHERE "id" = ${rowId}`
    ).rejects.toThrow(/append-only/i);
  });

  it('still allows INSERT (append)', async () => {
    await writeAdminAuditLog(prisma, {
      actor: ACTOR,
      action: 'int-test-append',
      target: 'audit-immutability-2',
    });
    const count = await prisma.adminAuditLog.count({ where: { actor: ACTOR } });
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
