/**
 * moderation — admin content-moderation services (Issue 069, Part C).
 *
 * "Disable, never edit" (AC4): admins moderate by flipping a single moderation
 * kill-switch column — Trip.moderatedAt / Route.moderatedAt — and NEVER touch any
 * catalog field (price, departureAt, origin/destination, etc.). A non-null
 * moderatedAt hides the item from search + direct links (already wired into
 * lib/db/searchTrips.ts + getTripDetails.ts in Parts A+B). Enabling clears it.
 *
 * resolveReport closes an OPEN ContentReport (status → 'resolved' + who/when).
 *
 * Reuse-by-param Prisma client (mirrors disableOperator.ts / suspendCustomer.ts) so
 * the same core runs under the app singleton and a test client. Each mutation +
 * its AdminAuditLog row run inside one $transaction.
 */

import type { PrismaClient } from '@prisma/client';
import { writeAdminAuditLog } from '@/lib/audit/adminAuditLog';

export interface SetTripModerationInput {
  tripId: string;
  /** true → disable (stamp moderatedAt); false → enable (clear moderatedAt). */
  disabled: boolean;
  /** Who performed the action — recorded verbatim in AdminAuditLog.actor. */
  actor: string;
  /** Optional free-text reason, redacted into the audit args. */
  reason?: string;
}

export interface SetRouteModerationInput {
  routeId: string;
  disabled: boolean;
  actor: string;
  reason?: string;
}

export interface ResolveReportInput {
  reportId: string;
  actor: string;
}

export async function setTripModeration(
  prisma: PrismaClient,
  { tripId, disabled, actor, reason }: SetTripModerationInput
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // ONLY moderatedAt — never any catalog field (AC4: disable, never edit).
    await tx.trip.update({
      where: { id: tripId },
      data: { moderatedAt: disabled ? new Date() : null },
    });

    await writeAdminAuditLog(tx, {
      actor,
      action: disabled ? 'moderate-disable-trip' : 'moderate-enable-trip',
      target: tripId,
      argsRedacted: JSON.stringify({ reason: reason ?? null }),
    });
  });
}

export async function setRouteModeration(
  prisma: PrismaClient,
  { routeId, disabled, actor, reason }: SetRouteModerationInput
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // ONLY moderatedAt — never any catalog field (AC4: disable, never edit).
    await tx.route.update({
      where: { id: routeId },
      data: { moderatedAt: disabled ? new Date() : null },
    });

    await writeAdminAuditLog(tx, {
      actor,
      action: disabled ? 'moderate-disable-route' : 'moderate-enable-route',
      target: routeId,
      argsRedacted: JSON.stringify({ reason: reason ?? null }),
    });
  });
}

export async function resolveReport(
  prisma: PrismaClient,
  { reportId, actor }: ResolveReportInput
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.contentReport.update({
      where: { id: reportId },
      data: { status: 'resolved', resolvedBy: actor, resolvedAt: new Date() },
    });

    await writeAdminAuditLog(tx, {
      actor,
      action: 'moderate-resolve-report',
      target: reportId,
    });
  });
}
