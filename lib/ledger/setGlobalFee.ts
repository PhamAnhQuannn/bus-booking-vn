/**
 * setGlobalFee (Issue 068) — write the GLOBAL platform-fee default as a NEW
 * effective-dated FeeConfig row (operatorId = NULL).
 *
 * This is the global-scope sibling of setOperatorFeeOverride (Issue 067). It
 * MIRRORS that service exactly, with the ONE difference that the new FeeConfig
 * row's operatorId is `null` (the global default) instead of a per-operator id.
 *
 * ── NEVER EDIT IN PLACE (AGENTS.md Mistake Log, Issue 013) ───────────────────
 * FeeConfig is effective-dated and change-audited (Issue 048): a fee change is a
 * NEW row, never an UPDATE of an existing row. getEffectiveFeeRate resolves the
 * winning global default as the global row with the latest `effectiveFrom`, so
 * inserting a new row with `effectiveFrom = now` makes it win cleanly. We do NOT
 * mutate any prior row's ratePpm.
 *
 * ── PRIOR-ROW CLOSE ──────────────────────────────────────────────────────────
 * As in 067, closing the previously-open GLOBAL row (effectiveTo = effectiveFrom)
 * is OPTIONAL for correctness (the resolver picks latest effectiveFrom) but keeps
 * the windows non-overlapping (exactly one open global row). The close targets
 * `operatorId: null` rows ONLY — it must NEVER close per-operator overrides, so
 * the where-clause pins `operatorId: null`. Close + insert + audit run in ONE
 * $transaction so they commit or roll back together.
 *
 * ── AUDIT ────────────────────────────────────────────────────────────────────
 * writeAdminAuditLog(tx, { action: 'global-fee-change', target: 'GLOBAL', ... })
 * is written INSIDE the same transaction. ratePpm + effectiveFrom are captured in
 * argsRedacted (no PII — purely numeric config).
 *
 * ── VALIDATION ───────────────────────────────────────────────────────────────
 * ratePpm must be an INTEGER in [0, MAX_GLOBAL_FEE_PPM] (0..20%). Out-of-range or
 * non-integer → GlobalFeeError('invalid_rate') which the route maps to 422.
 */

import { prisma as defaultPrisma } from '@/lib/core/db/client';
import { writeAdminAuditLog } from '@/lib/audit';

/** Upper bound for the global fee: 200000 ppm = 20% (mirrors MAX_FEE_OVERRIDE_PPM). */
export const MAX_GLOBAL_FEE_PPM = 200_000;

export class GlobalFeeError extends Error {
  constructor(public readonly code: 'invalid_rate') {
    super(code);
    this.name = 'GlobalFeeError';
  }
}

export interface SetGlobalFeeInput {
  /** New global default rate in parts-per-million (integer, 0..200000). */
  ratePpm: number;
  /** Audit actor, e.g. `admin:<adminId>`. */
  actor: string;
  /** When the new global rate takes effect. Defaults to now(). */
  effectiveFrom?: Date;
}

export interface SetGlobalFeeResult {
  feeConfigId: string;
}

/**
 * Minimal Prisma surface this service needs — the FeeConfig writes + the audit
 * write, plus $transaction. Typed loosely on the tx handle so both the real
 * client and a test stub satisfy it.
 */
interface GlobalFeePrisma {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
}

/**
 * Insert a new GLOBAL FeeConfig row (operatorId = null; never edits an existing
 * one), close the prior open global row, and write an audit row — all in one
 * transaction. Returns the new row's id.
 *
 * @throws GlobalFeeError('invalid_rate') when ratePpm is not an integer in range.
 */
export async function setGlobalFee(
  prisma: GlobalFeePrisma = defaultPrisma as unknown as GlobalFeePrisma,
  input: SetGlobalFeeInput
): Promise<SetGlobalFeeResult> {
  const { ratePpm, actor } = input;

  if (!Number.isInteger(ratePpm) || ratePpm < 0 || ratePpm > MAX_GLOBAL_FEE_PPM) {
    throw new GlobalFeeError('invalid_rate');
  }

  const effectiveFrom = input.effectiveFrom ?? new Date();

  return prisma.$transaction(async (tx) => {
    // Close the prior open GLOBAL row (operatorId: null, effectiveTo: null) so the
    // global windows stay non-overlapping. MUST pin operatorId: null — closing
    // per-operator overrides here would corrupt their effective windows.
    await tx.feeConfig.updateMany({
      where: { operatorId: null, effectiveTo: null },
      data: { effectiveTo: effectiveFrom },
    });

    // NEW global row — operatorId: null, never an in-place edit (Issue 013).
    const created = await tx.feeConfig.create({
      data: {
        operatorId: null,
        ratePpm,
        effectiveFrom,
        createdBy: actor,
      },
      select: { id: true },
    });

    await writeAdminAuditLog(tx, {
      actor,
      action: 'global-fee-change',
      target: 'GLOBAL',
      argsRedacted: JSON.stringify({ ratePpm, effectiveFrom }),
    });

    return { feeConfigId: created.id };
  });
}
