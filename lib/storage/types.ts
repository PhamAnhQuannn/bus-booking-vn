/**
 * Storage purpose taxonomy + per-purpose upload policy (Issue 059, SYS20).
 *
 * Each upload is tagged with a `StoragePurpose`. The per-purpose policy caps
 * the allowed content types and the maximum byte size — enforced at URL-minting
 * time so an over-size / wrong-type upload is rejected BEFORE a signed PUT URL
 * (or a StoredObject row) is ever created.
 */

/** Documented purpose union. The DB column is a plain String for extensibility. */
export type StoragePurpose = 'kyb_doc' | 'ticket_pdf';

export interface StoragePolicy {
  /** Maximum object size in bytes (inclusive). */
  maxBytes: number;
  /** Exact-match allowlist of acceptable Content-Type values. */
  allowedContentTypes: string[];
}

const MB = 1024 * 1024;

/**
 * Per-purpose upload policy.
 *  - kyb_doc:    operator KYB evidence — images + PDF, ≤ 10MB.
 *  - ticket_pdf: generated ticket PDF — application/pdf only, ≤ 5MB.
 */
export const STORAGE_POLICIES: Record<StoragePurpose, StoragePolicy> = {
  kyb_doc: {
    maxBytes: 10 * MB,
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
  ticket_pdf: {
    maxBytes: 5 * MB,
    allowedContentTypes: ['application/pdf'],
  },
};

/** Purposes whose objects are PII and whose downloads must be audited (AC5). */
export const PII_PURPOSES: ReadonlySet<StoragePurpose> = new Set<StoragePurpose>(['kyb_doc']);

export function isStoragePurpose(value: string): value is StoragePurpose {
  return value === 'kyb_doc' || value === 'ticket_pdf';
}
