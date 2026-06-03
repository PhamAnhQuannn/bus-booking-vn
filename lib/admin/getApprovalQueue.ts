/**
 * getApprovalQueue — operators awaiting an admin decision (Issue 065).
 *
 * In-process Prisma read (NEVER self-fetch — AGENTS.md Issue 002/003). Lists every
 * operator whose status is PENDING_REVIEW or UNDER_REVIEW, oldest first (FIFO —
 * the longest-waiting applicant surfaces at the top of the queue).
 *
 * Phone is masked via redactPhone() before leaving the DB — the admin needs a
 * glanceable contact, not the raw PII (the audit/contact path uses the unmasked
 * value elsewhere). Email is shown in full (admins contact applicants by email).
 *
 * KYB documents (Issue 077) and the payout account (Issue 078) are NOT built yet,
 * so each row carries an empty `docs: []` placeholder. When the StoredObject ↔
 * Operator linkage lands in Wave 5, wire signed GET URLs via
 * createSignedDownloadUrl here and populate `docs`.
 */

import type { OperatorStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/db/client';
import { redactPhone } from '@/lib/audit/redactPhone';

/** Operator statuses that still owe an admin decision. */
const PENDING_OPERATOR_STATUSES: OperatorStatus[] = ['PENDING_REVIEW', 'UNDER_REVIEW'];

export interface ApprovalQueueDoc {
  /** StoredObject key / id (Wave 5 — 077). */
  id: string;
  label: string;
  /** Signed, time-boxed GET URL (Wave 5 — 078). */
  url: string;
}

export interface ApprovalQueueOperator {
  id: string;
  legalName: string;
  contactEmail: string;
  /** Masked via redactPhone() — last 4 digits only. */
  contactPhone: string;
  status: OperatorStatus;
  createdAt: Date;
  rejectionReason: string | null;
  /** Wave 5 (077/078): KYB docs + payout account. Empty until the linkage exists. */
  docs: ApprovalQueueDoc[];
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
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((row) => ({
    id: row.id,
    legalName: row.legalName,
    contactEmail: row.contactEmail,
    contactPhone: redactPhone(row.contactPhone),
    status: row.status,
    createdAt: row.createdAt,
    rejectionReason: row.rejectionReason,
    // Wave 5 (077/078): KYB submission + payout account not yet linked to Operator.
    docs: [],
  }));
}
