/**
 * Retention policy windows (Issue 090, AC1).
 *
 * Two distinct retention obligations, each with its own window. Both windows are
 * defined here as named constants and consumed by:
 *   - lib/jobs/retentionSweeper.ts  (the daily run-locked sweeper that enforces them)
 *   - lib/account/anonymizeCustomer.ts (the on-demand booking-snapshot scrub)
 *
 * ERASE ≠ DELETE (S04): scrubbing a guest's PII snapshot does NOT delete the
 * booking. Money/audit columns (totalVnd, ticketCount, status, payment refs, the
 * LedgerEntry rows) are RETAINED — only the personal identifiers (buyer
 * name/phone/email) are overwritten with masked placeholders. Financial history
 * is immutable; personal data has a finite life.
 */

/**
 * GUEST_PII_RETENTION_DAYS — guest buyer PII snapshot retention (365 days).
 *
 * A guest (customerId IS NULL) booking carries a name/phone/email SNAPSHOT taken
 * at checkout (Booking.buyerName / buyerPhone / buyerEmail). One year after the
 * trip departs (Trip.departureAt < NOW() - 365d), that snapshot is scrubbed to
 * masked placeholders and Booking.snapshotAnonymizedAt is stamped.
 *
 * RETAINED through the scrub: totalVnd, ticketCount, status, paymentMethod /
 * paymentExternalRef, and all LedgerEntry rows (money + audit history, S04).
 */
export const GUEST_PII_RETENTION_DAYS = 365;

/**
 * KYB_DOC_RETENTION_DAYS — KYB document storage retention (90 days).
 *
 * A KybDocument's stored object is purged from storage 90 days after the owning
 * operator is REJECTED or SUSPENDED/DEACTIVATED — at that point the document is
 * no longer needed for review or compliance review. ACTIVE/approved operators'
 * documents are RETAINED (still needed for ongoing compliance).
 *
 * The purge window is anchored on the document's uploadedAt (the earliest
 * defensible "no longer needed" clock available on the row); the operator-status
 * gate (REJECTED / SUSPENDED, optionally via disabledAt) decides WHETHER a doc is
 * eligible at all. After purge, KybDocument.purgedAt is stamped (idempotency
 * marker) — the pointer row is retained, only the storage object is removed.
 */
export const KYB_DOC_RETENTION_DAYS = 90;
