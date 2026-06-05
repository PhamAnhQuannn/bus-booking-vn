/**
 * Issue 077: operator KYB (Know-Your-Business) document submission service.
 *
 * Upload flow is signed-PUT — the server NEVER proxies bytes (AGENTS.md Issue
 * 002/003). `requestKybUploadUrl` validates the doc type, mints a signed PUT URL
 * via the storage layer (lib/storage, Issue 059 — which enforces content-type +
 * size and audits PII), and persists a KybDocument pointer row holding the
 * storage KEY. The client then PUTs the file directly to the returned uploadUrl.
 *
 * MVP note: if the client's direct PUT fails after this returns, the KybDocument
 * row (and its StoredObject pointer) are orphaned — there are no bytes behind the
 * key. This is acceptable for MVP (a re-upload creates a fresh row + key; the
 * orphan is harmless and admin-invisible until a sweeper is added). Documented
 * here so a future reader doesn't treat an orphan as corruption.
 *
 * STATE EFFECT (`submitForReview`): doc UPLOAD alone does NOT change operator
 * state. The operator must explicitly click "Submit for review", which transitions
 * PENDING_REVIEW → UNDER_REVIEW via the Issue 045 transition service (the single
 * source of truth for legal operator-status moves). Only PENDING_REVIEW is a legal
 * source for that edge; the 045 map throws illegal_transition for any other state.
 *
 * The Prisma client is taken as a parameter (reuse-by-param, like lib/storage) so
 * unit tests inject a mock and route handlers pass the app singleton.
 */

import { createSignedUploadUrl, type StorageClient } from '@/lib/storage';
import { transitionOperatorStatus } from '@/lib/onboarding/operatorStatus';

/** Documented union of KYB document types (DB column is a plain String). */
export const KYB_DOC_TYPES = ['business_license', 'identity', 'payout_account'] as const;
export type KybDocType = (typeof KYB_DOC_TYPES)[number];

export function isKybDocType(value: string): value is KybDocType {
  return (KYB_DOC_TYPES as readonly string[]).includes(value);
}

/** Tagged error for the KYB service; route handlers map `code` → HTTP status. */
export type KybErrorCode = 'invalid_type';

export class KybError extends Error {
  constructor(
    public readonly code: KybErrorCode,
    public readonly detail?: string
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'KybError';
  }
}

/** A KybDocument row as returned to the operator's own list. */
export interface KybDocumentRow {
  id: string;
  operatorId: string;
  type: string;
  storageKey: string;
  status: string;
  uploadedAt: Date;
}

/**
 * The slice of PrismaClient this module needs, combined with StorageClient so a
 * single injected client satisfies both the KybDocument reads/writes and the
 * storage layer's StoredObject + audit-log writes.
 */
export interface KybPrismaClient extends StorageClient {
  kybDocument: {
    create: (args: {
      data: { operatorId: string; type: string; storageKey: string; status?: string };
    }) => Promise<KybDocumentRow>;
    findMany: (args: {
      where: { operatorId: string };
      orderBy?: { uploadedAt: 'asc' | 'desc' };
    }) => Promise<KybDocumentRow[]>;
  };
}

export interface RequestKybUploadUrlInput {
  operatorId: string;
  type: string;
  contentType: string;
  sizeBytes: number;
}

export interface RequestKybUploadUrlResult {
  uploadUrl: string;
  key: string;
  kybDocumentId: string;
}

/**
 * Validate the doc type, mint a signed PUT URL (storage layer enforces
 * content-type + size and may throw StorageError 'invalid_content_type' /
 * 'too_large'), and persist a KybDocument pointer row.
 *
 * @throws KybError('invalid_type') if `type` is not a documented KYB type.
 * @throws StorageError (surfaced from createSignedUploadUrl) on content-type/size.
 */
export async function requestKybUploadUrl(
  prisma: KybPrismaClient,
  input: RequestKybUploadUrlInput
): Promise<RequestKybUploadUrlResult> {
  const { operatorId, type, contentType, sizeBytes } = input;

  if (!isKybDocType(type)) {
    throw new KybError('invalid_type', `unknown kyb doc type: ${type}`);
  }

  // Storage layer (059) validates content-type + size and throws BEFORE any row
  // is written, so a rejected upload leaves no orphan StoredObject pointer.
  const { uploadUrl, key } = await createSignedUploadUrl(prisma, {
    purpose: 'kyb_doc',
    contentType,
    sizeBytes,
    uploadedBy: `operator:${operatorId}`,
    keyHint: type,
  });

  const row = await prisma.kybDocument.create({
    data: { operatorId, type, storageKey: key, status: 'submitted' },
  });

  return { uploadUrl, key, kybDocumentId: row.id };
}

/** List an operator's own KYB documents, newest first. */
export async function listOperatorKybDocs(
  prisma: KybPrismaClient,
  operatorId: string
): Promise<KybDocumentRow[]> {
  return prisma.kybDocument.findMany({
    where: { operatorId },
    orderBy: { uploadedAt: 'desc' },
  });
}

export interface SubmitForReviewInput {
  operatorId: string;
  /** Identifies the actor (e.g. `operator:<operatorId>`) for the 045 audit row. */
  actor: string;
}

/**
 * Operator clicks "Submit for review": transition PENDING_REVIEW → UNDER_REVIEW
 * via the Issue 045 transition service. Only legal from PENDING_REVIEW — the 045
 * map throws OperatorStatusError('illegal_transition') for any other source state
 * (which the route maps to 422).
 */
export async function submitForReview(input: SubmitForReviewInput): Promise<void> {
  const { operatorId, actor } = input;
  await transitionOperatorStatus({ operatorId, to: 'UNDER_REVIEW', actor });
}
