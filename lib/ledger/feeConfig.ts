/**
 * feeConfig (Issue 048) — read side of the effective-dated platform-fee source.
 *
 * SYS20: the ledger domain owns fee/payout, so the fee-rate resolver lives here
 * (not under lib/payouts). Slice 049 cuts calcPayout over to call these.
 *
 * ── RATE ENCODING ──────────────────────────────────────────────────────────
 * Rates are parts-per-million (ppm) INTEGERS: 60000 ppm = 60000 / 1_000_000 =
 * 0.06 = 6%. Storing the rate as an integer lets the whole fee computation stay
 * in the BigInt domain with zero float drift (Issue 016):
 *
 *     fee = amountMinor * ratePpm / 1_000_000   (all BigInt)
 *
 * `applyFeePpm` below is that computation, exported for slice 049 to reuse.
 *
 * ── ROUNDING ───────────────────────────────────────────────────────────────
 * applyFeePpm uses BigInt `/`, which truncates toward zero (floor for the
 * non-negative amounts we deal with). Documented as floor/truncation — NOT
 * half-even. Slice 049 owns whether the payout path needs a different rounding
 * mode; this helper is the raw, exact integer-division primitive.
 */

import { prisma } from '@/lib/db/client';

/**
 * One part-per-million denominator. ES2017 target ⇒ no `n` BigInt literals
 * (parser error); use the BigInt() constructor everywhere.
 */
const PPM_DENOMINATOR = BigInt(1_000_000);

/**
 * Apply a ppm fee rate to a minor-unit amount, entirely in the BigInt domain.
 *
 *     applyFeePpm(250000n, 60000) === 15000n   // 6% of 250,000
 *
 * Rounding: BigInt `/` truncates toward zero (floor for non-negative amounts).
 *
 * @param amountMinor integer minor units (VND) as a bigint.
 * @param ratePpm     fee rate in parts-per-million (60000 = 6%).
 * @returns fee in minor units (bigint), floored.
 */
export function applyFeePpm(amountMinor: bigint, ratePpm: number): bigint {
  return (amountMinor * BigInt(ratePpm)) / PPM_DENOMINATOR;
}

/**
 * Apply a ppm fee rate to a minor-unit amount with HALF-EVEN (banker's) rounding,
 * entirely in the BigInt domain.
 *
 *     calcPlatformFeeMinor(BigInt(250000), 60000) === BigInt(15000)   // 6% of 250,000
 *
 * ── WHY HALF-EVEN (not floor like applyFeePpm) ─────────────────────────────
 * This is the fee that gets WRITTEN to the ledger as a `platform_fee` entry at
 * booking-paid (slice 049). It MUST match the legacy `calcPayout.ts` output
 * bit-for-bit so the migration to ledger-derived balances (slice 050) is a
 * pure no-op on the money: calcPayout rounds the fee half-even (numerator /
 * PRECISION with a remainder*2-vs-denominator tie test). `applyFeePpm` floors,
 * which would diverge from calcPayout on any .5 midpoint — so we replicate the
 * EXACT half-even remainder logic here instead.
 *
 * ppm 60000 / 1_000_000 == 0.06, the same rate calcPayout's default uses, so
 * `calcPlatformFeeMinor(BigInt(g), 60000)` and `calcPayout({grossPaidBookings:g})
 * .platformFee` agree for every g (proven by a parity test).
 *
 * Mirrors calcPayout's tie logic: quotient = product / denom; remainder =
 * product % denom; doubled = remainder*2; doubled<denom → down, doubled>denom →
 * up, doubled==denom → round to even. ES2017 target ⇒ BigInt() ctor only, never
 * `n` literals.
 *
 * @param grossMinor integer minor units (VND) as a bigint.
 * @param feePpm     fee rate in parts-per-million (60000 = 6%).
 * @returns fee in minor units (bigint), half-even rounded.
 */
export function calcPlatformFeeMinor(grossMinor: bigint, feePpm: number): bigint {
  const product = grossMinor * BigInt(feePpm);
  const quotient = product / PPM_DENOMINATOR;
  const remainder = product % PPM_DENOMINATOR;

  // Half-even round: compare remainder*2 to the denominator (PPM_DENOMINATOR).
  const doubled = remainder * BigInt(2);
  if (doubled < PPM_DENOMINATOR) {
    return quotient;
  }
  if (doubled > PPM_DENOMINATOR) {
    return quotient + BigInt(1);
  }
  // Exact tie — round to even.
  return quotient % BigInt(2) === BigInt(0) ? quotient : quotient + BigInt(1);
}

/**
 * Minimal prisma surface this module needs — eases mocking in unit tests AND
 * lets a Prisma `$transaction` tx handle be passed in (Issue 049: the webhook
 * resolves the fee rate inside its tx). `findMany`'s arg is `any` so the real
 * (typed) Prisma method and the tx handle are both assignable — a function
 * typed to accept `unknown` would reject the real client (its param is narrower
 * than `unknown`, so it cannot stand in for a fn that must accept anything).
 */
interface FeeConfigReader {
  feeConfig: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args: any) => Promise<FeeConfigRow[]>;
  };
}

interface FeeConfigRow {
  operatorId: string | null;
  ratePpm: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

/**
 * Resolve the platform fee rate (ppm) in force for `operatorId` at `atTime`.
 *
 * Looks at every FeeConfig row that is either the global default (operatorId
 * NULL) or this operator's override (operatorId = <op>), and whose effective
 * window contains `atTime` (`effectiveFrom <= atTime < effectiveTo`, with a NULL
 * effectiveTo meaning open-ended).
 *
 * Resolution is OVERRIDE-THEN-GLOBAL:
 *   1. If any matching per-operator override row exists, the override with the
 *      latest effectiveFrom wins.
 *   2. Otherwise the global (NULL) row with the latest effectiveFrom wins.
 *
 * Throwing (rather than silently defaulting) when no row matches is the honest
 * choice: post-cutover-seed there is ALWAYS a covering global row, so a miss
 * signals a real data problem (e.g. an effectiveFrom in the future of every
 * row) that must surface, not be masked by a magic 60000 fallback.
 *
 * @param operatorId operator id, or null to resolve the global rate directly.
 * @param atTime     the instant the rate must be in force for.
 * @param client     prisma client (defaults to the shared singleton; injectable
 *                   for tests).
 * @returns the resolved ratePpm (integer).
 * @throws if no FeeConfig row covers (operatorId|global, atTime).
 */
export async function getEffectiveFeeRate(
  operatorId: string | null,
  atTime: Date,
  client: FeeConfigReader = prisma as unknown as FeeConfigReader
): Promise<number> {
  const rows = await client.feeConfig.findMany({
    where: {
      effectiveFrom: { lte: atTime },
      // Two independent OR groups must be AND-ed (a single `where` object can't
      // carry two `OR` keys): (scope) AND (effective window still open).
      AND: [
        // scope: global default OR this operator's override
        { OR: [{ operatorId: null }, ...(operatorId ? [{ operatorId }] : [])] },
        // window upper bound: open-ended OR ends strictly after atTime
        { OR: [{ effectiveTo: null }, { effectiveTo: { gt: atTime } }] },
      ],
    },
    select: {
      operatorId: true,
      ratePpm: true,
      effectiveFrom: true,
      effectiveTo: true,
    },
  });

  if (rows.length === 0) {
    throw new Error(
      `getEffectiveFeeRate: no FeeConfig row covers operator=${
        operatorId ?? 'GLOBAL'
      } at ${atTime.toISOString()} (expected at least the cutover global row)`
    );
  }

  // Override-then-global: among override rows pick latest effectiveFrom; only
  // fall back to the global rows if there is no matching override.
  const overrides = rows.filter((r) => r.operatorId !== null);
  const globals = rows.filter((r) => r.operatorId === null);
  const pool = overrides.length > 0 ? overrides : globals;

  const winner = pool.reduce((best, r) =>
    r.effectiveFrom.getTime() > best.effectiveFrom.getTime() ? r : best
  );

  return winner.ratePpm;
}
