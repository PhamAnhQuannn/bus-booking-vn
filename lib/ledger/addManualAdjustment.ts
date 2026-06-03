/**
 * addManualAdjustment (Issue 068) — record a MANUAL operator-balance correction
 * as a single immutable `adjustment` LedgerEntry. MONEY-ADJACENT.
 *
 * An admin (FINANCE / SUPER_ADMIN, step-up gated at the route) credits or debits
 * an operator's balance to correct a discrepancy. The amount is SIGNED minor units
 * (VND): positive = credit TO the operator, negative = debit FROM them. `adjustment`
 * COUNTS toward the operator balance (OPERATOR_BALANCE_TYPES, Issue 051).
 *
 * ── UNIQUE sourceEventId PER ACTION (idempotency-key contract) ───────────────
 * appendLedgerEntry is idempotent on `sourceEventId` — a duplicate key is a no-op
 * re-read. A MANUAL adjustment has no natural external event id, and two distinct
 * manual adjustments (even same operator + amount + reason) are SEPARATE money
 * events that must BOTH land. So we mint a fresh UUID per call:
 *     sourceEventId = 'adjustment:' + randomUUID()
 * This guarantees every manual adjustment is a distinct ledger row and can NEVER
 * collide with another adjustment, with refundOut's `refund_*`, the chargeback
 * backstop's `chargeback_backstop:` adjustments, or any other keyed entry.
 *
 * ── REASON REQUIRED ──────────────────────────────────────────────────────────
 * A manual money move MUST be justified — a non-empty `reason` is required (the
 * route's zod schema is the first gate; this is the floor of defence). The reason
 * is captured in the audit row's argsRedacted alongside the amount.
 *
 * ── AUDIT ────────────────────────────────────────────────────────────────────
 * writeAdminAuditLog(action: 'ledger-adjustment', target: operatorId) is written
 * in the SAME $transaction as the ledger append, so the money write and its audit
 * trail commit or roll back together.
 *
 * ── ARITHMETIC (Issue 016) ───────────────────────────────────────────────────
 * amountMinor is coerced to the BigInt domain (BigInt(amountMinor)) before the
 * ledger write — no float math. ES2017 target ⇒ BigInt() constructor, never the
 * `n` literal suffix.
 */

import { randomUUID } from 'node:crypto';
import { prisma as defaultPrisma } from '@/lib/core/db/client';
import { appendLedgerEntry } from './ledgerRepo';
import { writeAdminAuditLog } from '@/lib/audit/adminAuditLog';

export class ManualAdjustmentError extends Error {
  constructor(public readonly code: 'invalid_amount' | 'missing_reason') {
    super(code);
    this.name = 'ManualAdjustmentError';
  }
}

export interface AddManualAdjustmentInput {
  operatorId: string;
  /** SIGNED minor units (VND). Negative = debit, positive = credit. Must be an integer ≠ 0. */
  amountMinor: number;
  /** Non-empty justification — recorded in the audit row. */
  reason: string;
  /** Audit actor, e.g. `admin:<adminId>`. */
  actor: string;
}

export interface AddManualAdjustmentResult {
  ledgerEntryId: string;
}

/**
 * Minimal Prisma surface — $transaction (callback form) so the ledger append +
 * the audit write share one transaction. Loose tx typing so both the real client
 * and a test stub satisfy it.
 */
interface ManualAdjustmentPrisma {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
}

/**
 * Append one manual `adjustment` ledger entry (unique sourceEventId per call) and
 * write its audit row in the same transaction. Returns the new ledger row id.
 *
 * @throws ManualAdjustmentError('missing_reason') when reason is empty/whitespace.
 * @throws ManualAdjustmentError('invalid_amount') when amountMinor is non-integer or 0.
 */
export async function addManualAdjustment(
  prisma: ManualAdjustmentPrisma = defaultPrisma as unknown as ManualAdjustmentPrisma,
  input: AddManualAdjustmentInput
): Promise<AddManualAdjustmentResult> {
  const { operatorId, amountMinor, reason, actor } = input;

  if (!reason || reason.trim().length === 0) {
    throw new ManualAdjustmentError('missing_reason');
  }
  if (!Number.isInteger(amountMinor) || amountMinor === 0) {
    // A zero adjustment is a no-op money move — reject it as invalid.
    throw new ManualAdjustmentError('invalid_amount');
  }

  // Fresh UUID per call ⇒ every manual adjustment is a DISTINCT ledger row that
  // can never collide with another adjustment or any other keyed entry.
  const sourceEventId = `adjustment:${randomUUID()}`;

  return prisma.$transaction(async (tx) => {
    const entry = await appendLedgerEntry(
      {
        operatorId,
        type: 'adjustment',
        // Signed minor units, BigInt domain (Issue 016).
        amountMinor: BigInt(amountMinor),
        currency: 'VND',
        sourceEventId,
      },
      tx
    );

    await writeAdminAuditLog(tx, {
      actor,
      action: 'ledger-adjustment',
      target: operatorId,
      argsRedacted: JSON.stringify({ amountMinor, reason }),
    });

    return { ledgerEntryId: entry.id };
  });
}
