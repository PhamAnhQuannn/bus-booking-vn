/**
 * suspendCustomer / reinstateCustomer — admin moderation of a customer account
 * (Issue 066).
 *
 * "Users" in the admin console spans customers + operators. Operator suspension is
 * the OperatorStatus → SUSPENDED transition (Issue 045/065); THIS module is the
 * customer-side equivalent, gated by the `Customer.suspendedAt` timestamp added in
 * the 20260602120000_customer_suspend migration.
 *
 * suspendCustomer — inside a $transaction:
 *   1. stamp Customer.suspendedAt = now()
 *   2. revoke ALL of the customer's live Session rows (mirror revokeSession's
 *      soft-delete: set revokedAt on every not-yet-revoked row). The refresh path
 *      then dies immediately; requireCustomerAuth's suspension gate (Issue 066)
 *      kills any access token still live until its short TTL elapses.
 *   3. AdminAuditLog row { action: 'suspend-customer' }.
 *   Idempotent: re-suspending an already-suspended customer RE-STAMPS suspendedAt
 *   (refreshing the timestamp) and re-revokes any sessions created since — both
 *   are no-ops in the steady state. The audit row is written each call so the
 *   action is always traceable.
 *
 * reinstateCustomer — clear Customer.suspendedAt and audit { action:
 *   'reinstate-customer' }. Does NOT restore the revoked sessions: a reinstated
 *   customer logs in fresh (the revoked sessions stay revoked forever).
 *
 * Reuse-by-param Prisma client (mirrors disableOperator.ts) so the same core runs
 * under the app singleton and under a test client.
 */

import type { PrismaClient } from '@prisma/client';
import { writeAdminAuditLog } from '@/lib/audit';

export interface SuspendCustomerInput {
  customerId: string;
  /** Who performed the action — recorded verbatim in AdminAuditLog.actor (e.g. "admin:<id>"). */
  actor: string;
}

export async function suspendCustomer(
  prisma: PrismaClient,
  { customerId, actor }: SuspendCustomerInput
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const now = new Date();

    await tx.customer.update({
      where: { id: customerId },
      data: { suspendedAt: now },
    });

    // Revoke every live session — soft-delete, mirroring revokeSession().
    const revoked = await tx.session.updateMany({
      where: { customerId, revokedAt: null },
      data: { revokedAt: now },
    });

    await writeAdminAuditLog(tx, {
      actor,
      action: 'suspend-customer',
      target: customerId,
      argsRedacted: JSON.stringify({ sessionsRevoked: revoked.count }),
    });
  });
}

export async function reinstateCustomer(
  prisma: PrismaClient,
  { customerId, actor }: SuspendCustomerInput
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customerId },
      data: { suspendedAt: null },
    });

    // NOTE: revoked sessions are intentionally NOT restored — the reinstated
    // customer authenticates fresh.
    await writeAdminAuditLog(tx, {
      actor,
      action: 'reinstate-customer',
      target: customerId,
    });
  });
}
