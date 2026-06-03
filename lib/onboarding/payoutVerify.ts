/**
 * Issue 078: payout-account ownership verification.
 *
 * Two methods exist in the spec; this slice IMPLEMENTS name-match and leaves a
 * documented HOOK for micro-deposit (AC2: one implemented + the other hooked).
 *
 *  - name_match (IMPLEMENTED): nameMatchScore() compares the account-holder name the
 *    operator entered against the operator's legal business name. A high score is a
 *    strong (not absolute) ownership signal an admin confirms at approval time.
 *  - micro_deposit (HOOKED): the platform would send a tiny deposit and the operator
 *    confirms the amount. Stubbed below — out of scope for this slice.
 *
 * confirmPayoutAccountOwnership() is the single write path that marks an account
 * verified (verifiedAt=now, verifyMethod=<method>) + writes an AdminAuditLog row.
 */

import type { PrismaClient } from '@prisma/client';
import { writeAdminAuditLog, type AdminAuditLogClient } from '@/lib/audit/adminAuditLog';

/** Result of the pure name-match scorer. */
export interface NameMatchResult {
  /** 0..1 similarity between holder name and business name (token overlap). */
  score: number;
  /** True when score >= the suggest-verified threshold (0.8). */
  suggestVerified: boolean;
}

/** Tokens that carry no identity signal — common VN/EN company-form suffixes. */
const COMPANY_SUFFIXES = new Set([
  'CO', 'CORP', 'CORPORATION', 'COMPANY', 'LTD', 'LIMITED', 'LLC', 'INC',
  'JSC', 'PLC', 'GROUP',
  // Vietnamese company forms.
  'TNHH', 'CTY', 'CP', 'MTV', 'DN', 'DNTN', 'HTX',
]);

/** Threshold at/above which a name match is strong enough to suggest verification. */
export const NAME_MATCH_VERIFY_THRESHOLD = 0.8;

/**
 * Normalize a name for comparison: uppercase, strip diacritics, drop punctuation,
 * collapse whitespace, then tokenize and drop common company-form suffix tokens.
 * Returns the significant token list.
 */
function normalizeTokens(name: string): string[] {
  const stripped = name
    .normalize('NFD')
    // Remove combining diacritical marks (NFD splits e.g. "ệ" → "e" + mark).
    .replace(/[̀-ͯ]/g, '')
    // Vietnamese "đ/Đ" has no combining-mark decomposition — handle explicitly.
    .replace(/[đ]/g, 'd')
    .replace(/[Đ]/g, 'D')
    .toUpperCase()
    // Punctuation → space.
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

  if (stripped.length === 0) return [];
  return stripped
    .split(/\s+/)
    .filter((tok) => tok.length > 0 && !COMPANY_SUFFIXES.has(tok));
}

/**
 * Score the similarity between an account-holder name and a business legal name.
 *
 * PURE function. Normalizes both (case/diacritic/punctuation/spacing-insensitive,
 * company-suffix-stripped), then computes a symmetric token-overlap (Jaccard-style)
 * score in [0,1]:
 *   - identical significant tokens (any order) → 1
 *   - one name a subset of the other → high
 *   - disjoint token sets → 0
 *
 * suggestVerified = score >= NAME_MATCH_VERIFY_THRESHOLD (0.8). The threshold is a
 * SUGGESTION for the admin, never an auto-approve — an admin always confirms.
 */
export function nameMatchScore(holderName: string, businessName: string): NameMatchResult {
  const a = normalizeTokens(holderName);
  const b = normalizeTokens(businessName);

  // If either side has no significant tokens, there is nothing to match on.
  if (a.length === 0 || b.length === 0) {
    return { score: 0, suggestVerified: false };
  }

  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const tok of setA) {
    if (setB.has(tok)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  const score = union === 0 ? 0 : intersection / union;

  return { score, suggestVerified: score >= NAME_MATCH_VERIFY_THRESHOLD };
}

export type PayoutVerifyMethod = 'name_match' | 'micro_deposit';

/** Tagged error for the verify write path. */
export type PayoutVerifyErrorCode = 'payout_account_not_found';

export class PayoutVerifyError extends Error {
  constructor(public readonly code: PayoutVerifyErrorCode) {
    super(code);
    this.name = 'PayoutVerifyError';
  }
}

export interface ConfirmPayoutAccountOwnershipInput {
  operatorId: string;
  method: PayoutVerifyMethod;
  /** Audit actor, e.g. `admin:<adminId>`. */
  actor: string;
}

/** Minimal prisma surface for the confirm write — findUnique + update + audit. */
type ConfirmPrismaLike = AdminAuditLogClient & {
  payoutAccount: {
    findUnique: PrismaClient['payoutAccount']['findUnique'];
    update: PrismaClient['payoutAccount']['update'];
  };
};

/**
 * Mark the operator's payout account verified: verifiedAt=now, verifyMethod=method,
 * plus an append-only AdminAuditLog row (action: 'verify-payout-account').
 *
 * @throws PayoutVerifyError('payout_account_not_found') if the operator has no
 *         registered payout account.
 */
export async function confirmPayoutAccountOwnership(
  prisma: ConfirmPrismaLike,
  input: ConfirmPayoutAccountOwnershipInput
): Promise<void> {
  const { operatorId, method, actor } = input;

  const account = await prisma.payoutAccount.findUnique({
    where: { operatorId },
    select: { id: true },
  });
  if (!account) {
    throw new PayoutVerifyError('payout_account_not_found');
  }

  await prisma.payoutAccount.update({
    where: { operatorId },
    data: { verifiedAt: new Date(), verifyMethod: method },
  });

  await writeAdminAuditLog(prisma, {
    actor,
    action: 'verify-payout-account',
    target: operatorId,
    // method only — the account number is NEVER written to the audit args (PII).
    argsRedacted: JSON.stringify({ method }),
  });
}

/**
 * TODO(micro-deposit): record a small deposit (e.g. a random sub-cent amount) sent
 * to the operator's registered account, then have the operator confirm the exact
 * amount they received. On a correct confirmation, call
 * confirmPayoutAccountOwnership(prisma, { operatorId, method: 'micro_deposit', actor }).
 * Out of scope for this slice — name_match is the implemented method. This stub
 * exists only to document the second verification rail's signature.
 */
export async function initiateMicroDeposit(_operatorId: string): Promise<never> {
  throw new Error('micro_deposit verification is not implemented in this slice (Issue 078)');
}
