/**
 * Issue 084: first-accept-wins atomic claim of a PUBLISHED public-pool charter lead.
 *
 * CONCURRENCY-CRITICAL. Unlike the Issue 083 direct-assign accept (which drives
 * the ASSIGNED_DIRECT → ACCEPTED edge through transitionCharterRequest with a
 * SELECT … FOR UPDATE), a public-pool claim is a DIRECT atomic conditional UPDATE
 * — the single-claim guard is the WHERE clause itself, not a row lock:
 *
 *   UPDATE "CharterRequest"
 *   SET "assigneeOperatorId" = $op, status = 'ACCEPTED', "updatedAt" = NOW()
 *   WHERE id = $charter
 *     AND status = 'PUBLISHED'
 *     AND "assigneeOperatorId" IS NULL
 *     AND ("claimByAt" IS NULL OR "claimByAt" > NOW())
 *
 * Two operators racing on the same pool item both issue this UPDATE; PostgreSQL
 * serialises the row write, so EXACTLY ONE gets rowcount 1 (the WIN) and the other
 * gets rowcount 0 — its WHERE no longer matches because status is already ACCEPTED
 * and assigneeOperatorId is no longer NULL (Mistake Log Issue 011: atomic
 * conditional UPDATE + rowcount, never read-then-write). The `claimByAt` predicate
 * makes an EXPIRED pool item un-claimable even though it is still PUBLISHED.
 *
 * CharterRequest.id is a cuid TEXT column — NO ::uuid cast (contrast checkIn.ts
 * which casts Booking.id ::uuid).
 *
 * WIN side-effects (Issue 084):
 *   (a) customer MATCH-notify — replicates the Issue 082 ACCEPTED side-effect
 *       (charterMatched sms + email to the customer) since the claim is a direct
 *       UPDATE, NOT a transitionCharterRequest call (which would otherwise enqueue
 *       it). Read ref/contactPhone/contactEmail + the winning operator's legalName.
 *   (b) operator WIN-notify — charterClaimWon sms + email to the operator's
 *       notification phone / contact email.
 *
 * The UPDATE + the payload reads run inside a single $transaction so the WIN is
 * atomic. The NotificationLog rows are enqueued AFTER commit (best-effort) so a
 * log-write failure can never roll back the claim — mirrors charterStatus.ts /
 * createOperator (AGENTS.md 002/003 + the Issue 082 post-commit pattern). A loser
 * (rowcount 0) changes nothing and enqueues nothing.
 *
 * Result is DISCRIMINATED (Mistake Log Issue 013): `{ ok:true }` on a win,
 * `{ ok:false, reason }` otherwise — never a thrown sentinel for the normal
 * already-claimed / not-found outcomes.
 */

import { Prisma, type PrismaClient } from '@prisma/client';
import { createNotificationLog } from '@/lib/core/db/notificationLogRepo';

export type ClaimCharterReason = 'already_claimed' | 'not_found';

export type ClaimCharterResult = { ok: true } | { ok: false; reason: ClaimCharterReason };

/** Minimal Prisma surface — accepts the app singleton or a tx-bearing client. */
type Db = Pick<PrismaClient, '$transaction'>;

/** The contact/ref fields the WIN notifications need, read off the won row in-tx. */
interface WinNotify {
  ref: string;
  contactPhone: string;
  contactEmail: string;
  operatorName: string | null;
  operatorNotifyPhone: string;
  operatorNotifyEmail: string;
}

/**
 * Atomically claim a PUBLISHED, unclaimed, not-yet-expired charter lead for
 * `operatorId`. First commit wins.
 *
 * @returns { ok:true } on a successful claim (the row is now ACCEPTED, assigned to
 *   this operator, and both win-notifications are enqueued).
 * @returns { ok:false, reason:'already_claimed' } if the row exists but is no
 *   longer claimable (already ACCEPTED / assigned, or its claimByAt has passed).
 * @returns { ok:false, reason:'not_found' } if no such charter row exists.
 */
export async function claimCharter(
  prisma: Db,
  { charterId, operatorId }: { charterId: string; operatorId: string },
): Promise<ClaimCharterResult> {
  // Carried out of the tx so the win-notifications enqueue AFTER commit — a
  // NotificationLog failure must never roll back the claim. Null unless we won.
  let winNotify: WinNotify | null = null;

  const result = await prisma.$transaction(async (tx) => {
    // ── The single-claim guard: atomic conditional UPDATE, rowcount-based. ──
    // id is cuid TEXT — no ::uuid cast. The claimByAt predicate blocks expired
    // pool items even while still PUBLISHED.
    const rowcount = await tx.$executeRaw(Prisma.sql`
      UPDATE "CharterRequest"
      SET "assigneeOperatorId" = ${operatorId},
          "status" = 'ACCEPTED'::"CharterStatus",
          "updatedAt" = NOW()
      WHERE "id" = ${charterId}
        AND "status" = 'PUBLISHED'::"CharterStatus"
        AND "assigneeOperatorId" IS NULL
        AND ("claimByAt" IS NULL OR "claimByAt" > NOW())
    `);

    if (rowcount === 1) {
      // WIN. Read the now-ACCEPTED row's contact + ref and the winning operator's
      // notification targets, all inside the same tx so the post-commit enqueue
      // has everything without a second round-trip.
      const rows = await tx.$queryRaw<
        Array<{
          ref: string;
          contactPhone: string;
          contactEmail: string;
          operatorName: string | null;
          operatorContactPhone: string | null;
          operatorNotificationPhone: string | null;
          operatorContactEmail: string | null;
        }>
      >(Prisma.sql`
        SELECT c."ref",
               c."contactPhone",
               c."contactEmail",
               o."legalName"          AS "operatorName",
               o."contactPhone"       AS "operatorContactPhone",
               o."notificationPhone"  AS "operatorNotificationPhone",
               o."contactEmail"       AS "operatorContactEmail"
        FROM "CharterRequest" c
        LEFT JOIN "Operator" o ON o."id" = ${operatorId}
        WHERE c."id" = ${charterId}
        LIMIT 1
      `);

      if (rows.length === 1) {
        const r = rows[0];
        winNotify = {
          ref: r.ref,
          contactPhone: r.contactPhone,
          contactEmail: r.contactEmail,
          operatorName: r.operatorName,
          // Prefer the dedicated notification phone, fall back to contact phone.
          operatorNotifyPhone: r.operatorNotificationPhone ?? r.operatorContactPhone ?? '',
          operatorNotifyEmail: r.operatorContactEmail ?? '',
        };
      }

      return { ok: true as const };
    }

    // rowcount 0 — the row was not claimable. Disambiguate not-found vs
    // already-claimed (existing-but-no-longer-PUBLISHED-or-unclaimed-or-expired).
    const existing = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "CharterRequest" WHERE "id" = ${charterId} LIMIT 1
    `);

    if (existing.length === 0) {
      return { ok: false as const, reason: 'not_found' as const };
    }
    return { ok: false as const, reason: 'already_claimed' as const };
  });

  // Post-commit, best-effort: enqueue the WIN notifications. A NotificationLog
  // failure here does not roll back the claim (the claim already committed).
  if (winNotify) {
    try {
      const w: WinNotify = winNotify;

      // (a) Customer match-notify — replicate the Issue 082 ACCEPTED side-effect.
      const matchPayload = JSON.stringify({ ref: w.ref, operatorName: w.operatorName });
      await createNotificationLog({
        channel: 'sms',
        template: 'charterMatched',
        recipient: w.contactPhone,
        payload: matchPayload,
        status: 'pending',
      });
      await createNotificationLog({
        channel: 'email',
        template: 'charterMatched',
        recipient: w.contactEmail,
        payload: matchPayload,
        status: 'pending',
      });

      // (b) Operator win-notify — charterClaimWon to the operator's targets.
      const winPayload = JSON.stringify({ ref: w.ref });
      if (w.operatorNotifyPhone) {
        await createNotificationLog({
          channel: 'sms',
          template: 'charterClaimWon',
          recipient: w.operatorNotifyPhone,
          payload: winPayload,
          status: 'pending',
        });
      }
      if (w.operatorNotifyEmail) {
        await createNotificationLog({
          channel: 'email',
          template: 'charterClaimWon',
          recipient: w.operatorNotifyEmail,
          payload: winPayload,
          status: 'pending',
        });
      }
    } catch {
      // Best-effort: claim committed, notification log failure is non-fatal.
    }
  }

  return result;
}
