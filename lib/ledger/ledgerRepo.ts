/**
 * Ledger repository (Issue 047) — append-only double-entry money ledger.
 *
 * MONEY-CRITICAL. The LedgerEntry table is the system's money one-way door:
 * rows are INSERT-only. UPDATE and DELETE are blocked at the DB by the
 * `ledger_entry_immutable` trigger (migration 20260602020000_ledger_entry),
 * so even a buggy or malicious caller cannot mutate history.
 *
 * ── SIGN CONVENTION ────────────────────────────────────────────────────────
 * `amount` is a SIGNED integer in minor units (VND has no minor unit, so VND
 * minor units == VND). Positive = credit TO the operator's balance; negative =
 * debit FROM it. Per LedgerEntryType the *expected* sign is:
 *
 *    booking_credit   +   (operator earns the fare)
 *    platform_fee     −   (platform takes its cut)
 *    refund_debit     −   (operator's earned balance is clawed back)
 *    refund_out       −   (money paid back out to the customer)
 *    payout_debit     −   (operator balance drained when paid out)
 *    payout_reversal  +   (a failed/clawed-back payout restored to balance)
 *    chargeback       −   (bank-initiated reversal)
 *    adjustment       ±   (manual correction, either direction)
 *
 * This slice does NOT hard-enforce the sign per type — it stores exactly the
 * signed amount the caller provides. Sign enforcement belongs to the wiring
 * slices (049/050) that own each event's semantics.
 *
 * ── ARITHMETIC ─────────────────────────────────────────────────────────────
 * All amount math stays in the BigInt domain — NO float arithmetic (Issue 016).
 * Callers SHOULD pass integer minor units already. A `number` input is coerced
 * via BigInt(Math.round(n)) as a safety net only. Target is ES2017, so BigInt
 * literals (`0n`) are a parser error — use the BigInt() constructor everywhere.
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma, type LedgerEntryType } from '@prisma/client';

export type { LedgerEntryType };

export interface AppendLedgerEntryInput {
  operatorId: string;
  bookingId?: string;
  payoutId?: string;
  type: LedgerEntryType;
  /**
   * Signed minor units (VND). Prefer passing a bigint of integer minor units.
   * A number is coerced via BigInt(Math.round(n)) — callers must already hold
   * integer minor units; the round is a defensive net, not a currency rounder.
   */
  amountMinor: bigint | number;
  currency?: string;
  /** Idempotency key — unique per (type, source). Re-appends are no-ops. */
  sourceEventId: string;
}

export interface AppendLedgerEntryResult {
  id: string;
  /** true if this call inserted the row; false if it already existed (idempotent). */
  created: boolean;
}

/** Coerce a number|bigint amount into the BigInt domain without float drift. */
function toBigIntMinor(amount: bigint | number): bigint {
  if (typeof amount === 'bigint') return amount;
  // Defensive: callers should already pass integer minor units.
  return BigInt(Math.round(amount));
}

/**
 * Minimal Prisma surface this function needs — both the create (with select)
 * and the idempotent re-read (findUnique). A `Prisma.TransactionClient` (the tx
 * handle inside `$transaction`) satisfies this shape, so the webhook can append
 * ledger entries INSIDE its existing transaction. The global `prisma` client
 * satisfies it too — it is the default.
 */
export interface LedgerEntryWriter {
  ledgerEntry: {
    create: (args: {
      data: {
        operatorId: string;
        bookingId?: string;
        payoutId?: string;
        type: LedgerEntryType;
        amount: bigint;
        currency: string;
        sourceEventId: string;
      };
      select: { id: true };
    }) => Promise<{ id: string }>;
    findUnique: (args: {
      where: { sourceEventId: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
}

/**
 * Append one immutable ledger entry. Idempotent on `sourceEventId`:
 *   - first append for a sourceEventId inserts and returns { created: true }.
 *   - a duplicate sourceEventId (Prisma P2002) is a no-op — we re-read the
 *     existing row and return { created: false } with its id.
 *
 * `client` is injectable (defaults to the shared singleton). Pass a Prisma tx
 * handle to write the entry inside an enclosing `$transaction` — the P2002
 * re-read uses the SAME client so the idempotent path stays inside the tx.
 */
export async function appendLedgerEntry(
  input: AppendLedgerEntryInput,
  client: LedgerEntryWriter = prisma as unknown as LedgerEntryWriter
): Promise<AppendLedgerEntryResult> {
  const amount = toBigIntMinor(input.amountMinor);

  try {
    const row = await client.ledgerEntry.create({
      data: {
        operatorId: input.operatorId,
        bookingId: input.bookingId,
        payoutId: input.payoutId,
        type: input.type,
        amount,
        currency: input.currency ?? 'VND',
        sourceEventId: input.sourceEventId,
      },
      select: { id: true },
    });
    return { id: row.id, created: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // Idempotent re-append: the row already exists for this sourceEventId.
      // Re-read with the SAME client so an in-tx append stays in the tx.
      const existing = await client.ledgerEntry.findUnique({
        where: { sourceEventId: input.sourceEventId },
        select: { id: true },
      });
      if (existing) return { id: existing.id, created: false };
    }
    throw e;
  }
}

/**
 * Derive an operator's balance as the simple SUM of all their ledger entries
 * (signed minor units), returned as a BigInt.
 *
 * STUB: this is the naive total. The full state-grouped balance (available vs
 * pending vs paid-out buckets) lands in slice 050. We keep the value in the
 * integer domain end-to-end — Postgres SUM(BIGINT) returns NUMERIC, so we cast
 * to text and parse with BigInt() rather than letting it become a JS number.
 */
export async function deriveOperatorBalance(operatorId: string): Promise<bigint> {
  const rows = await prisma.$queryRaw<{ sum: string }[]>`
    SELECT COALESCE(SUM("amount"), 0)::text AS sum
    FROM "LedgerEntry"
    WHERE "operatorId" = ${operatorId}
  `;
  return BigInt(rows[0]?.sum ?? '0');
}
