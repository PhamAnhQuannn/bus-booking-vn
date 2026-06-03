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
 * KYB documents (Issue 077) are populated from the operator's KybDocument rows.
 * The list query does NOT mint signed GET URLs (N operators × M docs = too many
 * short-lived URLs minted eagerly + a PII-audit row per doc on every queue
 * render). Instead each doc carries its id + type + status + uploadedAt, and the
 * admin Approvals UI renders a "View" link that hits a per-doc signed-GET endpoint
 * on demand (which audits the access then). The payout account (Issue 078) is a
 * separate concern and not surfaced here.
 */

import type { OperatorStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/db/client';
import { redactPhone } from '@/lib/audit/redactPhone';

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

export interface ApprovalQueueOperator {
  id: string;
  legalName: string;
  contactEmail: string;
  /** Masked via redactPhone() — last 4 digits only. */
  contactPhone: string;
  status: OperatorStatus;
  createdAt: Date;
  rejectionReason: string | null;
  /** Issue 077: the operator's submitted KYB documents (no signed URLs here). */
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
      // Issue 077: include the operator's KYB docs (no signed URLs — minted on
      // demand by the per-doc signed-GET endpoint when the admin clicks "View").
      kybDocuments: {
        select: { id: true, type: true, status: true, uploadedAt: true },
        orderBy: { uploadedAt: 'asc' },
      },
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
    docs: row.kybDocuments.map((doc) => ({
      id: doc.id,
      type: doc.type,
      status: doc.status,
      uploadedAt: doc.uploadedAt,
    })),
  }));
}
