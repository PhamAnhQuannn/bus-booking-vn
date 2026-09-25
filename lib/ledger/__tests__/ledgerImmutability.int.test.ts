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
import { LedgerEntryType } from '@prisma/client';
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

describe('HD-009 — every LedgerEntryType round-trips its BigInt amount intact (#765c)', () => {
  // AC(c): every enum value has a covered append + read-back. Iterating Object.values keeps
  // this count-agnostic — a new LedgerEntryType (e.g. psp_fee) is covered the moment it is
  // added to the schema, with no test edit. Amounts are large + signed to prove no float drift.
  it.each(Object.values(LedgerEntryType))('stores and reads %s with the exact minor-unit amount', async (type) => {
    // Positive for credit-like, negative for debit-like — sign is caller-supplied here.
    const magnitude = BigInt('900000000001') + BigInt(Object.values(LedgerEntryType).indexOf(type));
    const amountMinor = type === 'booking_credit' || type === 'payout_reversal' ? magnitude : -magnitude;
    const sourceEventId = `hd009:type-coverage:${type}:${operatorId}`;

    const res = await appendLedgerEntry({ operatorId, type, amountMinor, sourceEventId });
    expect(res.created).toBe(true);

    const row = await prisma.ledgerEntry.findUnique({
      where: { sourceEventId },
      select: { type: true, amount: true },
    });
    expect(row?.type).toBe(type);
    expect(row?.amount).toBe(amountMinor); // exact BigInt, no Number coercion
  });
});

describe('HD-009 — sourceEventId uniqueness is DB-enforced (#765d)', () => {
  it('a duplicate sourceEventId insert is rejected by the unique index (P2002)', async () => {
    const sourceEventId = `hd009:uniqueness:${operatorId}`;
    const first = await appendLedgerEntry({
      operatorId,
      type: 'adjustment',
      amountMinor: BigInt(1_234),
      sourceEventId,
    });
    expect(first.created).toBe(true);

    // Raw create bypasses appendLedgerEntry's P2002 catch, so the constraint surfaces.
    await expect(
      prisma.ledgerEntry.create({
        data: { operatorId, type: 'adjustment', amount: BigInt(5_678), currency: 'VND', sourceEventId },
        select: { id: true },
      })
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
