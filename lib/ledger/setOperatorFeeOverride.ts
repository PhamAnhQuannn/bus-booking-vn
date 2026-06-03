/**
 * setOperatorFeeOverride (Issue 067, Part B) — write a per-operator platform-fee
 * override as a NEW effective-dated FeeConfig row.
 *
 * ── NEVER EDIT IN PLACE (AGENTS.md Mistake Log, Issue 013) ───────────────────
 * FeeConfig is effective-dated and change-audited (Issue 048): a fee change is a
 * NEW row, never an UPDATE of an existing row. getEffectiveFeeRate resolves the
 * winning override as the row with the latest `effectiveFrom`, so inserting a new
 * row with `effectiveFrom = now` makes it win cleanly. We do NOT mutate any prior
 * row's ratePpm.
 *
 * ── OPTIONAL PRIOR-ROW CLOSE ─────────────────────────────────────────────────
 * getEffectiveFeeRate already picks the latest-effectiveFrom override, so closing
 * the previously-open override (setting its `effectiveTo = effectiveFrom`) is
 * OPTIONAL for correctness. We DO close it — it keeps the table tidy (one open
 * override per operator) and makes the effective windows non-overlapping, which is
 * easier to reason about in reports. The close + the insert + the audit row all run
 * in ONE $transaction so they commit or roll back together.
 *
 * ── AUDIT ────────────────────────────────────────────────────────────────────
 * writeAdminAuditLog(tx, { action: 'operator-fee-override', target: operatorId, ... })
 * is written INSIDE the same transaction (mirrors transitionOperatorStatus's
 * in-tx audit, Issue 065). The effectiveFrom + ratePpm are captured in argsRedacted
 * (no PII — purely numeric config).
 *
 * ── VALIDATION ───────────────────────────────────────────────────────────────
 * ratePpm must be an INTEGER in [0, MAX_FEE_OVERRIDE_PPM] (0..20%). A non-integer,
 * negative, or out-of-range rate throws FeeOverrideError('invalid_rate') which the
 * route maps to 422. This is the floor of defence; the route's zod schema is the
 * first.
 */

import { prisma as defaultPrisma } from '@/lib/core/db/client';
import { writeAdminAuditLog } from '@/lib/audit/adminAuditLog';

/** Upper bound for a per-operator override: 200000 ppm = 20%. */
export const MAX_FEE_OVERRIDE_PPM = 200_000;

export class FeeOverrideError extends Error {
  constructor(public readonly code: 'invalid_rate') {
    super(code);
    this.name = 'FeeOverrideError';
  }
}

export interface SetOperatorFeeOverrideInput {
  operatorId: string;
  /** New override rate in parts-per-million (integer, 0..200000). */
  ratePpm: number;
  /** Audit actor, e.g. `admin:<adminId>`. */
  actor: string;
  /** When the new override takes effect. Defaults to now(). */
  effectiveFrom?: Date;
}

export interface SetOperatorFeeOverrideResult {
  feeConfigId: string;
}

/**
 * Minimal Prisma surface this service needs — the FeeConfig writes + the audit
 * write, plus $transaction. Typed loosely on the tx handle so both the real
 * client and a test stub satisfy it.
 */
interface FeeOverridePrisma {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
}

/**
 * Insert a new per-operator FeeConfig override row (never edits an existing one),
 * optionally closing the prior open override, and write an audit row — all in one
 * transaction. Returns the new row's id.
 *
 * @throws FeeOverrideError('invalid_rate') when ratePpm is not an integer in range.
 */
export async function setOperatorFeeOverride(
  prisma: FeeOverridePrisma = defaultPrisma as unknown as FeeOverridePrisma,
  input: SetOperatorFeeOverrideInput
): Promise<SetOperatorFeeOverrideResult> {
  const { operatorId, ratePpm, actor } = input;

  if (!Number.isInteger(ratePpm) || ratePpm < 0 || ratePpm > MAX_FEE_OVERRIDE_PPM) {
    throw new FeeOverrideError('invalid_rate');
  }

  const effectiveFrom = input.effectiveFrom ?? new Date();

  return prisma.$transaction(async (tx) => {
    // Close the prior open override for this operator (effectiveTo = effectiveFrom)
    // so the effective windows stay non-overlapping. OPTIONAL for correctness
    // (the resolver picks latest effectiveFrom), but keeps one open override.
    await tx.feeConfig.updateMany({
      where: { operatorId, effectiveTo: null },
      data: { effectiveTo: effectiveFrom },
    });

    // NEW row — never an in-place edit (Issue 013).
    const created = await tx.feeConfig.create({
      data: {
        operatorId,
        ratePpm,
        effectiveFrom,
        createdBy: actor,
      },
      select: { id: true },
    });

    await writeAdminAuditLog(tx, {
      actor,
      action: 'operator-fee-override',
      target: operatorId,
      argsRedacted: JSON.stringify({ ratePpm, effectiveFrom }),
    });

    return { feeConfigId: created.id };
  });
}
