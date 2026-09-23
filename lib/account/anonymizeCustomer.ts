/**
 * Soft-delete / anonymize customer account (Issue 008 AC5).
 *
 * Design decision #1: NULL the phone (Postgres allows multiple NULLs on @unique).
 *
 * Issue 090 (AC4) — the PARTIAL fix: deleting a customer must ALSO scrub the guest
 * PII SNAPSHOT carried on THEIR bookings (Booking.buyerName / buyerPhone /
 * buyerEmail). Before 090 the Booking rows were retained UNTOUCHED, so a deleted
 * customer's name/phone/email still lived on every booking they made — defeating
 * the account-deletion erasure. The snapshot is now overwritten with masked
 * placeholders and Booking.snapshotAnonymizedAt is stamped, in the SAME
 * transaction as the customer anonymize.
 *
 * ERASE ≠ DELETE (S04): the booking rows are RETAINED — only the personal
 * identifiers are scrubbed. totalVnd / status / ticketCount / paymentMethod and
 * all LedgerEntry rows (money + audit history) are untouched. Financial history is
 * immutable; personal data has a finite life.
 *
 * PDPL hardening (2026-09): a SOFT delete never fires the Customer `onDelete: Cascade`
 * relations, so several PII stores would outlive the deletion request. In the SAME tx
 * we now also: HARD-delete the customer's PlannerConversation chat (W1), scrub their
 * booking-notification recipient/payload (W4), and scrub contact PII on their TERMINAL
 * charter leads (W6). The ticket-PDF object is purged by the retention sweeper on the
 * next tick (snapshotAnonymizedAt gates it; W3) — kept out of this tx (storage I/O).
 *
 * Returns a discriminated result { customer, alreadyDeleted } for idempotent 200.
 * Does NOT throw on second call — per plan rule "idempotent ops whose AC specifies 200+discriminator".
 */

import { prisma } from '@/lib/core/db/client';
import { TERMINAL_CHARTER_STATUSES } from '@/lib/charter';

/**
 * Masked PII placeholders for the on-delete booking-snapshot scrub. The phone
 * uses a literal-x mask so it can NEVER match the project's gitleaks phone regex
 * (\+84[35789]\d{8}) — \d{8} cannot consume the 'x' chars (AGENTS.md Issue 001).
 */
const DELETED_BUYER_NAME = '[deleted]';
const DELETED_BUYER_PHONE = '+8490xxxxxx0';

export interface DeleteAccountResult {
  customer: {
    id: string;
    deletedAt: Date | null;
    anonymizedAt: Date | null;
    phone: string | null;
  };
  alreadyDeleted: boolean;
}

export async function deleteAccount(customerId: string): Promise<DeleteAccountResult> {
  // Idempotent check: if already deleted, return discriminated result
  const existing = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, deletedAt: true, anonymizedAt: true, phone: true },
  });

  if (!existing) {
    // Non-existent customer treated as already-deleted (idempotent)
    return {
      customer: { id: customerId, deletedAt: null, anonymizedAt: null, phone: null },
      alreadyDeleted: true,
    };
  }

  if (existing.deletedAt !== null) {
    return { customer: existing, alreadyDeleted: true };
  }

  const now = new Date();

  const customer = await prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id: customerId },
      data: {
        phone: null,        // freed — Postgres allows multiple NULLs on @unique
        displayName: 'Deleted user',  // AC5: anonymize buyer-name identity
        deletedAt: now,
        anonymizedAt: now,
      },
      select: { id: true, deletedAt: true, anonymizedAt: true, phone: true },
    });

    // Revoke all sessions (design decision #2)
    await tx.session.updateMany({
      where: { customerId },
      data: { revokedAt: now },
    });

    // DS-033: sever OAuth provider links (Google). A soft delete keeps the Customer
    // row, so Account rows would NOT cascade — delete them explicitly so the Google
    // `sub` no longer resolves to this (deleted) customer on a future sign-in.
    await tx.account.deleteMany({ where: { customerId } });

    // Issue 090 (AC4): scrub the guest PII snapshot on THIS customer's bookings.
    // Money/audit columns (totalVnd/status/ticketCount/ledger) are RETAINED — only
    // the buyer identifiers are masked. snapshotAnonymizedAt is stamped so the
    // retention sweeper treats these rows as already-scrubbed (idempotency marker).
    // Skip rows already scrubbed (snapshotAnonymizedAt set) so re-anonymize is a no-op.
    await tx.booking.updateMany({
      where: { customerId, snapshotAnonymizedAt: null },
      data: {
        buyerName: DELETED_BUYER_NAME,
        buyerPhone: DELETED_BUYER_PHONE,
        buyerEmail: null,
        snapshotAnonymizedAt: now,
      },
    });

    // PDPL W1: a soft delete never fires the Customer→PlannerConversation cascade, so
    // the customer's free-text planner chat would outlive their deletion request. HARD
    // delete it here (messages cascade). No money/audit value — nothing to retain.
    await tx.plannerConversation.deleteMany({ where: { customerId } });

    // PDPL W4: scrub the customer's booking-notification PII immediately (recipient +
    // payload carry buyer name/phone/email). Pending rows are ALSO marked failed so the
    // dispatcher never sends a deleted customer's notification. Row kept (delivery audit).
    await tx.notificationLog.updateMany({
      where: { booking: { customerId }, redactedAt: null, status: 'pending' },
      data: { recipient: 'ANONYMIZED', payload: '{}', lastError: null, redactedAt: now, status: 'failed' },
    });
    await tx.notificationLog.updateMany({
      where: { booking: { customerId }, redactedAt: null, status: { not: 'pending' } },
      data: { recipient: 'ANONYMIZED', payload: '{}', lastError: null, redactedAt: now },
    });

    // PDPL W6: scrub contact PII on the customer's TERMINAL charter leads. A LIVE lead
    // keeps its contact (an operator is still handling it off-platform) and falls to the
    // 365d sweeper arm once it goes terminal. ref/status/assignee retained (lead audit).
    await tx.charterRequest.updateMany({
      where: { customerId, contactScrubbedAt: null, status: { in: [...TERMINAL_CHARTER_STATUSES] } },
      data: {
        contactName: DELETED_BUYER_NAME,
        contactPhone: DELETED_BUYER_PHONE,
        contactEmail: '[deleted]',
        notes: null,
        contactScrubbedAt: now,
      },
    });

    return updated;
  });

  return { customer, alreadyDeleted: false };
}
