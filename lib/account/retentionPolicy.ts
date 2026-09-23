/**
 * Retention policy windows (Issue 090, AC1; PDPL hardening 2026-09).
 *
 * Named retention windows, each its own constant, consumed by:
 *   - lib/jobs/retentionSweeper.ts  (the daily run-locked sweeper that enforces them)
 *   - lib/account/anonymizeCustomer.ts (the on-demand purge/scrub at account deletion)
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

/**
 * ORPHAN_PAYMENT_PII_RETENTION_DAYS — orphan PaymentEvent payer-PII retention (365 days).
 *
 * An ORPHAN bank-transfer PaymentEvent (bookingId IS NULL, #332) stores the raw SePay
 * webhook body, which carries the payer's name (in `description`) and bank account
 * (`accountNumber`/`subAccount`). The row is the ONLY evidence money arrived, so it is
 * NEVER deleted. 365 days after receipt the retention sweeper strips those PII keys from
 * rawBody — KEEPING the money-evidence fields (amount / txn-id / timestamp / memo) — and
 * stamps PaymentEvent.redactedAt. Matches the guest-PII window; 365d leaves ample time to
 * reconcile a stray transfer against the bank statement (and to resolve any chargeback
 * dispute, DS-010) before the payer detail is scrubbed. ERASE ≠ DELETE (S04).
 */
export const ORPHAN_PAYMENT_PII_RETENTION_DAYS = 365;

/**
 * PLANNER_CHAT_RETENTION_DAYS — trip-planner conversation retention (90 days).
 *
 * A `PlannerConversation` (+ its `PlannerMessage` rows) carries the customer's
 * free-text travel chat. Unlike bookings/payments it has NO money/audit obligation,
 * so 90 days after the last activity (`updatedAt`) the whole conversation is HARD
 * DELETED (messages cascade) — not scrubbed-in-place: a scrub leaves `dtoJson`
 * itinerary snapshots that can be re-identified. Anchored on `updatedAt` (last turn),
 * so an actively-used conversation keeps living until the customer stops.
 *
 * Also enforced eagerly at account deletion (lib/account/anonymizeCustomer.ts) —
 * a soft delete never fires the Customer→PlannerConversation cascade.
 */
export const PLANNER_CHAT_RETENTION_DAYS = 90;

/**
 * NOTIFICATION_PII_RETENTION_DAYS — NotificationLog PII retention (180 days).
 *
 * A `NotificationLog` row stores `recipient` (phone/email) + `payload` (the rendered
 * SMS/email body, embedding buyer name + trip detail) + `lastError`. 180 days after
 * `createdAt`, on a NON-pending row, those PII fields are scrubbed (recipient
 * 'ANONYMIZED', payload '{}', lastError NULL) and `redactedAt` is stamped. The row is
 * KEPT (delivery-audit evidence: which template went out for which booking, when).
 * erase != delete (S04).
 */
export const NOTIFICATION_PII_RETENTION_DAYS = 180;

/**
 * CHARTER_CONTACT_RETENTION_DAYS — CharterRequest contact-PII retention (365 days).
 *
 * A `CharterRequest` (guest-allowed: customerId nullable) holds `contactName/Phone/
 * Email/notes`. 365 days after the lead reaches a TERMINAL status (REJECTED /
 * COMPLETED / CANCELLED — anchored on `updatedAt`, the last transition), those contact
 * fields are scrubbed to masked placeholders and `contactScrubbedAt` is stamped.
 * ref/status/assignee/destinations are RETAINED (operator-lead audit trail). A live
 * lead is NEVER scrubbed (an operator still needs the contact). erase != delete (S04).
 */
export const CHARTER_CONTACT_RETENTION_DAYS = 365;
