/**
 * getApprovalQueue — operators awaiting an admin decision (Issue 065).
 *
 * In-process Prisma read (NEVER self-fetch — AGENTS.md Issue 002/003). Lists every
 * operator whose status is PENDING_REVIEW or UNDER_REVIEW, oldest first (FIFO —
 * the longest-waiting applicant surfaces at the top of the queue).
 *
 * Phone and email are shown in full — admins need to contact applicants during review.
 *
 * KYB documents (Issue 077) are populated from the operator's KybDocument rows.
 * The list query does NOT mint signed GET URLs (N operators × M docs = too many
 * short-lived URLs minted eagerly + a PII-audit row per doc on every queue
 * render). Instead each doc carries its id + type + status + uploadedAt, and the
 * admin Approvals UI renders a "View" link that hits a per-doc signed-GET endpoint
 * on demand (which audits the access then).
 *
 * Issue 078: each operator's registered PayoutAccount is surfaced (bankName, MASKED
 * accountNumber, accountHolderName, verifiedAt) PLUS a nameMatchScore signal of the
 * holder name vs the operator's legalName, so the admin sees the ownership signal
 * before confirming. The account number is masked here — the admin never needs the
 * full number to confirm ownership.
 */

import type { OperatorStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/core/db/client';
import { maskAccountNumber } from '@/lib/onboarding';
import { nameMatchScore } from '@/lib/onboarding';

/** Operator statuses that still owe an admin decision. */
const PENDING_OPERATOR_STATUSES: OperatorStatus[] = ['PENDING_REVIEW', 'UNDER_REVIEW'];

export interface ApprovalQueueDoc {
  /** KybDocument row id — used to build the per-doc signed-GET endpoint URL. */
  id: string;
  /** Documented type union: 'business_license' | 'identity' | 'payout_account'. */
  type: string;
  /** 'submitted' | 'accepted' | 'rejected'. */
  status: string;
  uploadedAt: Date;
}

/** Issue 078: the operator's payout account surfaced for admin review (number masked). */
export interface ApprovalQueuePayoutAccount {
  bankName: string;
  /** Last-4 only — the admin never needs the full number. */
  accountNumberMasked: string;
  accountHolderName: string;
  verifiedAt: Date | null;
  verifyMethod: string | null;
  /** Name-match signal: holderName vs operator legalName, 0..1. */
  nameMatchScore: number;
  /** True when nameMatchScore >= the suggest-verified threshold. */
  suggestVerified: boolean;
}

export interface ApprovalQueueOperator {
  id: string;
  legalName: string;
  contactEmail: string;
  contactPhone: string;
  status: OperatorStatus;
  createdAt: Date;
  rejectionReason: string | null;
  /** Issue 077: the operator's submitted KYB documents (no signed URLs here). */
  docs: ApprovalQueueDoc[];
  /** Issue 078: registered payout account + name-match signal, or null if none. */
  payoutAccount: ApprovalQueuePayoutAccount | null;
}

/** Minimal prisma surface — lets unit tests inject a findMany stub. */
type PrismaLike = Pick<typeof defaultPrisma, 'operator'>;

export async function getApprovalQueue(
  prisma: PrismaLike = defaultPrisma
): Promise<ApprovalQueueOperator[]> {
  const rows = await prisma.operator.findMany({
    where: { status: { in: PENDING_OPERATOR_STATUSES } },
    select: {
      id: true,
      legalName: true,
      contactEmail: true,
      contactPhone: true,
      status: true,
      createdAt: true,
      rejectionReason: true,
      // Issue 077: include the operator's KYB docs (no signed URLs — minted on
      // demand by the per-doc signed-GET endpoint when the admin clicks "View").
      kybDocuments: {
        select: { id: true, type: true, status: true, uploadedAt: true },
        orderBy: { uploadedAt: 'asc' },
      },
      // Issue 078: surface the operator's payout account for the verify-at-approval
      // flow. accountNumber is selected only to MASK it below — it is never returned
      // in full from this read.
      payoutAccount: {
        select: {
          bankName: true,
          accountNumber: true,
          accountHolderName: true,
          verifiedAt: true,
          verifyMethod: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((row) => {
    const pa = row.payoutAccount;
    const payoutAccount: ApprovalQueuePayoutAccount | null = pa
      ? (() => {
          const match = nameMatchScore(pa.accountHolderName, row.legalName);
          return {
            bankName: pa.bankName,
            accountNumberMasked: maskAccountNumber(pa.accountNumber),
            accountHolderName: pa.accountHolderName,
            verifiedAt: pa.verifiedAt,
            verifyMethod: pa.verifyMethod,
            nameMatchScore: match.score,
            suggestVerified: match.suggestVerified,
          };
        })()
      : null;

    return {
      id: row.id,
      legalName: row.legalName,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      status: row.status,
      createdAt: row.createdAt,
      rejectionReason: row.rejectionReason,
      docs: row.kybDocuments.map((doc) => ({
        id: doc.id,
        type: doc.type,
        status: doc.status,
        uploadedAt: doc.uploadedAt,
      })),
      payoutAccount,
    };
  });
}
