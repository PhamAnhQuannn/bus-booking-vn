/**
 * settlePayout — bank-settlement dispatch stub (Issue 019).
 *
 * V1 stub: performs no real network I/O. Returns ok by default so the payout
 * processor transitions requested → processing → paid. When the env flag
 * PAYOUT_SETTLEMENT_FORCE_FAIL is "true" it returns a failure result, letting
 * the processor's failed-path AC (requested → processing → failed) be exercised
 * in tests.
 *
 * Discriminated result — never throws. When real bank HTTP lands, this is the
 * call that must move outside the job transaction (claim-then-dispatch outbox,
 * see lib/jobs/withAdvisoryLock.ts V1 note).
 */

import { getEnv } from '@/lib/config';

export interface SettlePayoutInput {
  payoutId: string;
  operatorId: string;
  net: number;
}

export type SettlePayoutResult = { ok: true } | { ok: false; reason: string };

export async function settlePayout(_input: SettlePayoutInput): Promise<SettlePayoutResult> {
  if (getEnv().PAYOUT_SETTLEMENT_FORCE_FAIL) {
    return { ok: false, reason: 'settlement_forced_fail' };
  }
  return { ok: true };
}
