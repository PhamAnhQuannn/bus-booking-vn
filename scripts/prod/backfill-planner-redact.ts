/**
 * One-off: backfill PII redaction over PlannerMessage rows written BEFORE the redact
 * patch (#757). Those user-turn rows still hold un-redacted phone/email/CCCD/self-declared
 * names. The retention sweeper can't reach them: PlannerConversation.updatedAt is bumped on
 * every new turn, so an actively-used old conversation never ages past the 90-day window —
 * its old messages would stay un-redacted forever. This runs redactPii over them once.
 *
 * SAFE by construction:
 *   - Dry by default (counts only). Pass --confirm to write.
 *   - Only user-turn rows (role='user') older than --before are touched.
 *   - The UPDATE is guarded `WHERE id = $id AND text = $oldText` — race-safe against a
 *     concurrent replaceMessages (if the row changed since we read it, we skip it).
 *   - redactPii is a fixed point (idempotent), so a re-run over already-clean rows is a no-op.
 *   - NEVER logs message text (only ids/counts).
 *
 * Run (against the target DB — use the Neon DIRECT URL for prod, not the pooled URL):
 *   DATABASE_URL=<direct-url> pnpm planner:backfill-redact --before=2026-09-23T00:00:00Z          # DRY: count
 *   DATABASE_URL=<direct-url> pnpm planner:backfill-redact --before=2026-09-23T00:00:00Z --confirm # write
 *
 * --before = the instant #757 went live in prod (rows created after it are already redacted).
 * --batch N (default 500) = keyset page size.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { redactPii } from '../../trip-planner/lib/planner/llm/redact';

/**
 * Pure planner: given rows, return only those whose user text changes under redactPii.
 * Extracted so it is unit-testable without a DB.
 */
export function planRedactions(
  rows: Array<{ id: string; text: string }>,
): Array<{ id: string; oldText: string; newText: string }> {
  const out: Array<{ id: string; oldText: string; newText: string }> = [];
  for (const r of rows) {
    const newText = redactPii(r.text);
    if (newText !== r.text) out.push({ id: r.id, oldText: r.text, newText });
  }
  return out;
}

async function run() {
  const argv = process.argv.slice(2);
  const has = (f: string) => argv.includes(f);
  const val = (f: string) => {
    const i = argv.indexOf(f);
    if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
    const eq = argv.find((a) => a.startsWith(`${f}=`));
    return eq ? eq.slice(f.length + 1) : undefined;
  };

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const beforeRaw = val('--before');
  if (!beforeRaw) throw new Error('Refusing to run: pass --before=<ISO instant of #757 prod deploy>.');
  const before = new Date(beforeRaw);
  if (Number.isNaN(before.getTime())) throw new Error(`--before is not a valid date: ${beforeRaw}`);
  const confirm = has('--confirm');
  const batch = Math.max(1, Number(val('--batch') ?? '500'));

  let cursor: string | undefined;
  let scanned = 0;
  let changed = 0;

  for (;;) {
    const rows = await prisma.plannerMessage.findMany({
      where: { role: 'user', createdAt: { lt: before } },
      select: { id: true, text: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: batch,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    scanned += rows.length;

    const plan = planRedactions(rows);
    if (confirm) {
      for (const p of plan) {
        // Guarded on the old text so a row changed by a concurrent replaceMessages is skipped.
        const res = await prisma.plannerMessage.updateMany({
          where: { id: p.id, text: p.oldText },
          data: { text: p.newText },
        });
        changed += res.count;
      }
    } else {
      changed += plan.length;
    }

    cursor = rows[rows.length - 1].id;
    if (rows.length < batch) break;
  }

  // No message text — counts only.
  console.log(
    `[backfill-planner-redact] mode=${confirm ? 'CONFIRM' : 'DRY'} before=${before.toISOString()} scanned=${scanned} ${confirm ? 'redacted' : 'would-redact'}=${changed}`,
  );

  await prisma.$disconnect();
  await pool.end();
}

// Only run when invoked directly (tsx scripts/prod/backfill-planner-redact.ts), NOT when
// imported by the unit test (which needs planRedactions without touching the DB).
const entry = process.argv[1] ?? '';
if (entry.includes('backfill-planner-redact')) {
  run().catch((err) => {
    console.error('[backfill-planner-redact] failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
