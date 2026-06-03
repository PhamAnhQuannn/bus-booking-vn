/**
 * Issue 086 — charterExpirySweeper integration tests (DB-gated). Run: pnpm vitest:int
 *
 * AC5: seed one stale ASSIGNED_DIRECT (acceptByAt in the past, assigned to an
 * APPROVED operator) + one expired PUBLISHED (claimByAt in the past) + one FRESH
 * ASSIGNED_DIRECT (acceptByAt in the future) → run the sweeper → assert:
 *   - both stale leads are now ADMIN_REVIEW,
 *   - the formerly-assigned stale one has assigneeOperatorId cleared + acceptByAt
 *     nulled (timeout frees the operator),
 *   - charterReturnedToReview notifications + admin-audit rows were written,
 *   - the FRESH (not-yet-expired) ASSIGNED_DIRECT is LEFT UNTOUCHED.
 *
 * The sweeper is a JobCore taking a tx as its first arg; here we pass the pooled
 * prisma client directly (the FOR UPDATE SKIP LOCKED claim selects + the per-row
 * transitions' own short transactions all work on the pooled client — runJob's
 * advisory-lock tx only adds the cross-tick lock, irrelevant to a single test run).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { charterExpirySweeper } from '@/lib/jobs/charterExpirySweeper';
import { generateCharterRef } from '../charterRef';

let opId: string;
const createdCharterIds: string[] = [];

async function makeCharter(opts: {
  status: 'ASSIGNED_DIRECT' | 'PUBLISHED';
  assigneeOperatorId?: string | null;
  acceptByAt?: Date | null;
  claimByAt?: Date | null;
}): Promise<{ id: string; ref: string }> {
  const ref = generateCharterRef();
  const row = await prisma.charterRequest.create({
    data: {
      ref,
      contactName: 'Charter Sweep Tester',
      contactPhone: '+8490xxxxxx3',
      contactEmail: 'sweep@charter.dev',
      destinations: ['Sa Pa'],
      startDate: new Date(Date.now() + 7 * 86_400_000),
      passengers: 30,
      vehicleType: 'coach',
      status: opts.status,
      assigneeOperatorId: opts.assigneeOperatorId ?? null,
      acceptByAt: opts.acceptByAt ?? null,
      claimByAt: opts.claimByAt ?? null,
    },
    select: { id: true, ref: true },
  });
  createdCharterIds.push(row.id);
  return row;
}

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: {
      legalName: 'Sweep Op',
      contactPhone: '+8490xxxxxx4',
      contactEmail: 'op@sweep.dev',
      status: 'APPROVED',
    },
  });
  opId = op.id;
});

afterAll(async () => {
  if (createdCharterIds.length) {
    await prisma.notificationLog.deleteMany({
      where: { template: 'charterReturnedToReview' },
    });
    await prisma.adminAuditLog.deleteMany({
      where: { target: { in: createdCharterIds } },
    });
    await prisma.charterRequest.deleteMany({ where: { id: { in: createdCharterIds } } });
  }
  await prisma.operator.deleteMany({ where: { id: opId } });
});

describe('charterExpirySweeper (AC5)', () => {
  it('reroutes stale assigned + expired published to ADMIN_REVIEW, leaves fresh untouched', async () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 3 * 86_400_000);

    const staleAssigned = await makeCharter({
      status: 'ASSIGNED_DIRECT',
      assigneeOperatorId: opId,
      acceptByAt: past,
    });
    const expiredPublished = await makeCharter({
      status: 'PUBLISHED',
      claimByAt: past,
    });
    const freshAssigned = await makeCharter({
      status: 'ASSIGNED_DIRECT',
      assigneeOperatorId: opId,
      acceptByAt: future,
    });

    const result = await charterExpirySweeper(prisma);

    // Both stale leads rerouted.
    expect(result.status).toBe('success');
    expect(result.rowsAffected).toBe(2);

    const assignedRow = await prisma.charterRequest.findUnique({
      where: { id: staleAssigned.id },
      select: { status: true, assigneeOperatorId: true, acceptByAt: true },
    });
    expect(assignedRow?.status).toBe('ADMIN_REVIEW');
    expect(assignedRow?.assigneeOperatorId).toBeNull();
    expect(assignedRow?.acceptByAt).toBeNull();

    const publishedRow = await prisma.charterRequest.findUnique({
      where: { id: expiredPublished.id },
      select: { status: true, claimByAt: true },
    });
    expect(publishedRow?.status).toBe('ADMIN_REVIEW');
    expect(publishedRow?.claimByAt).toBeNull();

    // Fresh assignment untouched.
    const freshRow = await prisma.charterRequest.findUnique({
      where: { id: freshAssigned.id },
      select: { status: true, assigneeOperatorId: true },
    });
    expect(freshRow?.status).toBe('ASSIGNED_DIRECT');
    expect(freshRow?.assigneeOperatorId).toBe(opId);

    // Notifications: sms + email per rerouted lead (2 leads → 4 rows).
    const notifs = await prisma.notificationLog.count({
      where: { template: 'charterReturnedToReview' },
    });
    expect(notifs).toBe(4);

    // Admin-audit rows written by the transitions (actor cron:charter-sweep).
    const audits = await prisma.adminAuditLog.count({
      where: { actor: 'cron:charter-sweep', target: { in: createdCharterIds } },
    });
    // assigned: 1 (→ADMIN_REVIEW); published: 2 (→EXPIRED, →ADMIN_REVIEW) = 3.
    expect(audits).toBe(3);

    // A JobRunLog is written by runJob, not the core — not asserted here (the core
    // never writes JobRunLog per the JobCore contract).
  });
});
