/**
 * Unit tests for lib/ledger/ledgerRepo.ts (Issue 047).
 *
 * prisma.ledgerEntry.{create,findUnique} are mocked. Asserts:
 *   - append returns { created: true } on first insert
 *   - duplicate sourceEventId (P2002) → { created: false } with existing id
 *   - large VND BigInt amount is preserved without float drift
 *   - number input is coerced to BigInt
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    ledgerEntry: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/client';
import { appendLedgerEntry } from '../ledgerRepo';

const create = prisma.ledgerEntry.create as unknown as ReturnType<typeof vi.fn>;
const findUnique = prisma.ledgerEntry.findUnique as unknown as ReturnType<typeof vi.fn>;

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.0.0',
  });
}

describe('appendLedgerEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts and returns { created: true } on first append', async () => {
    create.mockResolvedValue({ id: 'ledger-1' });

    const result = await appendLedgerEntry({
      operatorId: 'op-1',
      type: 'booking_credit',
      amountMinor: BigInt(250_000),
      sourceEventId: 'booking_credit:bk-1',
    });

    expect(result).toEqual({ id: 'ledger-1', created: true });
    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0];
    expect(arg.data.operatorId).toBe('op-1');
    expect(arg.data.type).toBe('booking_credit');
    expect(arg.data.sourceEventId).toBe('booking_credit:bk-1');
    expect(arg.data.currency).toBe('VND'); // default applied
  });

  it('is idempotent: duplicate sourceEventId (P2002) → { created: false } with existing id', async () => {
    create.mockRejectedValue(p2002());
    findUnique.mockResolvedValue({ id: 'ledger-existing' });

    const result = await appendLedgerEntry({
      operatorId: 'op-1',
      type: 'platform_fee',
      amountMinor: BigInt(-15_000),
      sourceEventId: 'platform_fee:bk-1',
    });

    expect(result).toEqual({ id: 'ledger-existing', created: false });
    expect(findUnique).toHaveBeenCalledWith({
      where: { sourceEventId: 'platform_fee:bk-1' },
      select: { id: true },
    });
  });

  it('preserves a large VND BigInt amount with no float drift', async () => {
    create.mockResolvedValue({ id: 'ledger-big' });

    const big = BigInt('99999999999'); // 99,999,999,999 VND — beyond a float-safe fare
    await appendLedgerEntry({
      operatorId: 'op-1',
      type: 'adjustment',
      amountMinor: big,
      sourceEventId: 'adjustment:big',
    });

    const arg = create.mock.calls[0][0];
    expect(typeof arg.data.amount).toBe('bigint');
    expect(arg.data.amount).toBe(big);
  });

  it('coerces a number input to BigInt', async () => {
    create.mockResolvedValue({ id: 'ledger-num' });

    await appendLedgerEntry({
      operatorId: 'op-1',
      type: 'booking_credit',
      amountMinor: 300_000,
      sourceEventId: 'booking_credit:num',
    });

    const arg = create.mock.calls[0][0];
    expect(typeof arg.data.amount).toBe('bigint');
    expect(arg.data.amount).toBe(BigInt(300_000));
  });

  it('passes a custom currency through unchanged', async () => {
    create.mockResolvedValue({ id: 'ledger-cur' });

    await appendLedgerEntry({
      operatorId: 'op-1',
      type: 'booking_credit',
      amountMinor: BigInt(1),
      currency: 'USD',
      sourceEventId: 'booking_credit:cur',
    });

    expect(create.mock.calls[0][0].data.currency).toBe('USD');
  });

  it('rethrows non-P2002 Prisma errors', async () => {
    const other = new Prisma.PrismaClientKnownRequestError('FK violation', {
      code: 'P2003',
      clientVersion: '7.0.0',
    });
    create.mockRejectedValue(other);

    await expect(
      appendLedgerEntry({
        operatorId: 'op-missing',
        type: 'booking_credit',
        amountMinor: BigInt(1),
        sourceEventId: 'booking_credit:fk',
      })
    ).rejects.toBe(other);
  });
});
