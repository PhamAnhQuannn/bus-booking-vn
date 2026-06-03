/**
 * Integration tests for LedgerEntry DB-enforced immutability (Issue 047).
 *
 * The core AC: LedgerEntry is append-only. The `ledger_entry_immutable` trigger
 * (migration 20260602020000_ledger_entry) blocks UPDATE and DELETE at the DB,
 * role-independently. This test inserts a row, then attempts a raw UPDATE and a
 * raw DELETE and asserts BOTH throw the trigger's exception.
 *
 * DB-gated — does not run locally (no DB); runs in CI against a migrated DB.
 *
 * Run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { appendLedgerEntry, deriveOperatorBalance } from '../ledgerRepo';

let operatorId: string;
let entryId: string;

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: { legalName: 'Ledger Test Op', contactPhone: '+8490xxxxxx7', contactEmail: 'ledger@ledger.test' },
  });
  operatorId = op.id;

  const created = await appendLedgerEntry({
    operatorId,
    type: 'booking_credit',
    amountMinor: BigInt(250_000),
    sourceEventId: 'ledger-int:booking_credit:' + operatorId,
  });
  entryId = created.id;
  expect(created.created).toBe(true);
});

afterAll(async () => {
  // Raw DELETE is blocked by the trigger, so we must drop the trigger to clean up.
  // Drop the triggers, delete the seeded rows, then disconnect.
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_update" ON "LedgerEntry"');
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "ledger_entry_no_delete" ON "LedgerEntry"');
  await prisma.ledgerEntry.deleteMany({ where: { operatorId } });
  // Re-create the triggers so the DB returns to its migrated state.
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_update" BEFORE UPDATE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER "ledger_entry_no_delete" BEFORE DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"()'
  );
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

describe('LedgerEntry immutability (DB trigger)', () => {
  it('blocks UPDATE on an existing entry', async () => {
    await expect(
      prisma.$executeRaw`UPDATE "LedgerEntry" SET "amount" = 1 WHERE "id" = ${entryId}`
    ).rejects.toThrow(/append-only/i);
  });

  it('blocks DELETE on an existing entry', async () => {
    await expect(
      prisma.$executeRaw`DELETE FROM "LedgerEntry" WHERE "id" = ${entryId}`
    ).rejects.toThrow(/append-only/i);
  });

  it('still allows INSERT (append) — and idempotent re-append is a no-op', async () => {
    const sourceEventId = 'ledger-int:adjustment:' + operatorId;
    const first = await appendLedgerEntry({
      operatorId,
      type: 'adjustment',
      amountMinor: BigInt(99_999_999_999),
      sourceEventId,
    });
    expect(first.created).toBe(true);

    const dup = await appendLedgerEntry({
      operatorId,
      type: 'adjustment',
      amountMinor: BigInt(99_999_999_999),
      sourceEventId,
    });
    expect(dup.created).toBe(false);
    expect(dup.id).toBe(first.id);
  });

  it('deriveOperatorBalance sums signed amounts as BigInt', async () => {
    // booking_credit 250_000 + adjustment 99_999_999_999 = 100_000_249_999
    const balance = await deriveOperatorBalance(operatorId);
    expect(typeof balance).toBe('bigint');
    expect(balance).toBe(BigInt('100000249999'));
  });
});
