/**
 * HD-011 (#770) — retention sweeper double-invoke idempotency.
 *
 * retentionSweeper is the #758 PDPL sweeper. retentionSweeper.int.test.ts proves its
 * per-arm OUTCOMES on a single run; this file proves the resilience axis the cron needs:
 * running it TWICE must not double-process. The other cron jobs' idempotency + the
 * advisory-lock skipped_locked path are already covered by cronJobs.int.test.ts (AC1/AC6);
 * the new retention sweeper was the gap.
 *
 * DB-gated — runs in CI / `pnpm vitest:int`, not locally.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { runJob } from '../runJob';
import { retentionSweeper } from '../retentionSweeper';

const p = { customer: '', staleConv: '', staleMsg: '', oldNotif: '' };
const testEpoch = new Date();

beforeAll(async () => {
  const c = await prisma.customer.create({ data: { displayName: 'Retn Idem Cust' } });
  p.customer = c.id;

  // Stale planner conversation (inactive > 90d) + a message → W2 hard-deletes both.
  const stale = await prisma.plannerConversation.create({
    data: { customerId: c.id, title: 'idem stale', messages: { create: [{ role: 'user', text: 'đi Đà Lạt' }] } },
    include: { messages: true },
  });
  p.staleConv = stale.id;
  p.staleMsg = stale.messages[0].id;
  await prisma.$executeRaw`UPDATE "PlannerConversation" SET "updatedAt" = NOW() - INTERVAL '120 days' WHERE "id" = ${stale.id}`;

  // Old sent notification (> 180d) → W4 scrubs recipient + payload.
  const oldN = await prisma.notificationLog.create({
    data: { template: 'ticketReady', recipient: 'idem@real.dev', payload: JSON.stringify({ buyerName: 'Idem Name' }), status: 'sent' },
  });
  p.oldNotif = oldN.id;
  await prisma.$executeRaw`UPDATE "NotificationLog" SET "createdAt" = NOW() - INTERVAL '200 days' WHERE "id" = ${oldN.id}`;
});

afterAll(async () => {
  // Idempotent — the stale conversation was hard-deleted by the sweeper; deleteMany tolerates absence.
  await prisma.plannerConversation.deleteMany({ where: { id: p.staleConv } });
  await prisma.notificationLog.deleteMany({ where: { id: p.oldNotif } });
  await prisma.customer.deleteMany({ where: { id: p.customer } });
  await prisma.jobRunLog.deleteMany({ where: { jobName: 'retention-sweep', startedAt: { gte: testEpoch } } });
  await prisma.$disconnect();
});

describe('retentionSweeper double-invoke idempotency (#770)', () => {
  it('second sequential run is a no-op (rowsAffected 0) and does not re-mangle scrubbed data', async () => {
    const seqStart = new Date();

    const first = await runJob('retention-sweep', retentionSweeper);
    expect(first.status).toBe('success');
    expect(first.rowsAffected).toBeGreaterThanOrEqual(1); // at least our stale conv + old notif

    const second = await runJob('retention-sweep', retentionSweeper);
    expect(second.status).toBe('success');
    expect(second.rowsAffected).toBe(0); // run 1 already cleared everything eligible

    // Data is stable after the second pass — not double-processed.
    expect(await prisma.plannerConversation.findUnique({ where: { id: p.staleConv } })).toBeNull();
    expect(await prisma.plannerMessage.findUnique({ where: { id: p.staleMsg } })).toBeNull();
    const notif = await prisma.notificationLog.findUnique({ where: { id: p.oldNotif } });
    expect(notif?.recipient).toBe('ANONYMIZED'); // not 'ANONYMIZED' mangled twice
    expect(notif?.payload).toBe('{}');
    expect(notif?.redactedAt).toBeInstanceOf(Date);

    // Exactly two JobRunLog rows for the two runs, both non-failed.
    const logs = await prisma.jobRunLog.findMany({
      where: { jobName: 'retention-sweep', startedAt: { gte: seqStart } },
      select: { status: true },
    });
    expect(logs.length).toBe(2);
    expect(logs.every((l) => l.status !== 'failed')).toBe(true);
  });

  it('two concurrent invocations do not throw or double-process (advisory lock)', async () => {
    // State is already clean from the sequential test. The advisory lock makes one win
    // and the other skip; neither should throw and no negative/double work is reported.
    const results = await Promise.all([
      runJob('retention-sweep', retentionSweeper),
      runJob('retention-sweep', retentionSweeper),
    ]);
    for (const r of results) {
      expect(['success', 'skipped_locked']).toContain(r.status);
      expect(r.rowsAffected).toBe(0);
    }
  });
});
