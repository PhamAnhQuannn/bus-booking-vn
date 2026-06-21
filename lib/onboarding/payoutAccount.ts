/**
 * Issue 078: operator payout-account registration + read (masked).
 *
 * The operator registers the single bank account the platform SENDS payouts to
 * (one per operator, keyed on operatorId @unique). The platform never reads the
 * operator's bank — it only credits accountNumber.
 *
 * SECURITY — edit resets verification: any change to the stored account (a new
 * accountNumber, a renamed holder, a different bank) sets verifiedAt=null AND
 * verifyMethod=null. An attacker who compromises an operator session and swaps the
 * destination to their own account MUST re-trigger ownership verification before
 * the payout rail (lib/ledger/withdrawal + lib/jobs/processPayouts) will send
 * there. We therefore reset on EVERY upsert (create or update) — even an apparent
 * no-op write re-arms the gate, which is the safe default for a money destination.
 *
 * PII — accountNumber is sensitive: getPayoutAccount() masks it to the last 4 for
 * display; getPayoutAccountInternal() returns it unmasked and is the ONLY read the
 * payout rail uses to resolve the send destination. accountNumber is also on the
 * logger redact list (lib/logger.ts).
 */

import { prisma as defaultPrisma } from '@/lib/core/db/client';
import { encryptBankField, decryptBankField } from '@/lib/security';

/** Minimal prisma surface — lets unit tests inject a payoutAccount stub. */
type PrismaLike = Pick<typeof defaultPrisma, 'payoutAccount'>;

export interface SetPayoutAccountInput {
  operatorId: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
}

/** Display shape — accountNumber MASKED to last 4 (never the full number). */
export interface MaskedPayoutAccount {
  bankName: string;
  /** Last-4 only, e.g. "••••6789". The raw number never leaves the DB on this path. */
  accountNumberMasked: string;
  accountHolderName: string;
  verifiedAt: Date | null;
  verifyMethod: string | null;
}

/** Internal shape — UNMASKED accountNumber. ONLY for the payout-send rail. */
export interface UnmaskedPayoutAccount {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  verifiedAt: Date | null;
  verifyMethod: string | null;
}

/**
 * Mask a bank account number to its last 4 digits, prefixed with bullets so the
 * masked form can never be mistaken for a real number. A short/empty number is
 * fully masked. The raw number is NEVER returned from a display path.
 */
export function maskAccountNumber(accountNumber: string): string {
  const last4 = accountNumber.slice(-4);
  if (accountNumber.length <= 4) return '••••';
  return `••••${last4}`;
}

/**
 * UPSERT the operator's payout account (one row per operator). Editing the account
 * RESETS verification (verifiedAt=null, verifyMethod=null) — see file header. We
 * set the reset on BOTH the create and update branch so a re-registration always
 * requires fresh ownership verification.
 */
export async function setPayoutAccount(
  prisma: PrismaLike,
  input: SetPayoutAccountInput
): Promise<void> {
  const { operatorId, bankName, accountNumber, accountHolderName } = input;
  const encrypted = encryptBankField(accountNumber);
  await prisma.payoutAccount.upsert({
    where: { operatorId },
    create: {
      operatorId,
      bankName,
      accountNumber: encrypted,
      accountHolderName,
      // New account starts unverified.
      verifiedAt: null,
      verifyMethod: null,
    },
    update: {
      bankName,
      accountNumber: encrypted,
      accountHolderName,
      // SECURITY: editing the destination RE-ARMS verification (file header).
      verifiedAt: null,
      verifyMethod: null,
    },
  });
}

/**
 * Read the operator's payout account for DISPLAY — accountNumber MASKED to last 4.
 * Returns null when the operator has not registered an account. Use this anywhere
 * the number reaches a client or an admin screen.
 */
export async function getPayoutAccount(
  prisma: PrismaLike,
  operatorId: string
): Promise<MaskedPayoutAccount | null> {
  const row = await prisma.payoutAccount.findUnique({ where: { operatorId } });
  if (!row) return null;
  return {
    bankName: row.bankName,
    accountNumberMasked: maskAccountNumber(decryptBankField(row.accountNumber)),
    accountHolderName: row.accountHolderName,
    verifiedAt: row.verifiedAt,
    verifyMethod: row.verifyMethod,
  };
}

/**
 * Internal UNMASKED read — ONLY the payout-send rail (resolving the bank
 * destination at send time) may call this. Never thread the result to a client.
 */
export async function getPayoutAccountInternal(
  prisma: PrismaLike,
  operatorId: string
): Promise<UnmaskedPayoutAccount | null> {
  const row = await prisma.payoutAccount.findUnique({ where: { operatorId } });
  if (!row) return null;
  return {
    bankName: row.bankName,
    accountNumber: decryptBankField(row.accountNumber),
    accountHolderName: row.accountHolderName,
    verifiedAt: row.verifiedAt,
    verifyMethod: row.verifyMethod,
  };
}

/**
 * Convenience guard for the payout rail: true when the operator has a registered
 * payout account AND it is verified (verifiedAt != null). Both the on-demand
 * withdrawal (Issue 053) and the auto-sweep (Issue 050) gate on this before
 * creating/processing a payout. Takes the tx/prisma handle so it can run inside a
 * transaction.
 */
export async function isPayoutAccountVerified(
  prisma: PrismaLike,
  operatorId: string
): Promise<boolean> {
  const row = await prisma.payoutAccount.findUnique({
    where: { operatorId },
    select: { verifiedAt: true },
  });
  return row?.verifiedAt != null;
}
