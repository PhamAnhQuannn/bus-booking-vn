// Cron contract check — LOCAL-ONLY (HG-B). Invoking a cron route EXECUTES the real job
// (process-payouts settles real payouts; anonymize-customers destroys real PII). This script
// HARD-REFUSES any non-localhost BASE_URL so it can never run against prod/preview.
//
// Contract (DS-006 §2.3, corrected 2026-08-04): the job result / HTTP body is {status, rowsAffected}.
// sweep-holds is the documented legacy exception ({mode, expiredCount, status}).
import type { Check } from './http-asserts.mjs';

export async function cronCheck(baseUrl: string, cronSecret: string | undefined): Promise<Check[]> {
  const host = new URL(baseUrl).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`cron-check REFUSES non-localhost target "${host}" — invoking cron executes real jobs (HG-B)`);
  }
  // Unconfigured ≠ contract broken → optional (WARN), don't fail the suite for a missing local env var.
  if (!cronSecret) return [{ name: 'cron-check (skipped)', ok: false, optional: true, detail: 'CRON_SECRET not set' }];

  const out: Check[] = [];
  const auth = { Authorization: `Bearer ${cronSecret}` };
  // sweep-holds is idempotent + safe locally; assert it responds with a status field.
  const r = await fetch(`${baseUrl}/api/cron/sweep-holds`, { headers: auth });
  out.push({ name: 'cron sweep-holds 200', ok: r.status === 200, detail: `status=${r.status}` });
  let body: Record<string, unknown> = {};
  try { body = await r.json(); } catch { /* */ }
  // sweep-holds legacy shape: {mode, expiredCount} in count mode, {mode, expiredCount, status} in update mode.
  // Assert the meaningful legacy fields (mode + numeric expiredCount) — status is mode-dependent.
  const okShape = typeof body.mode === 'string' && typeof body.expiredCount === 'number';
  out.push({ name: 'cron sweep-holds legacy shape {mode,expiredCount}', ok: okShape, detail: JSON.stringify(body).slice(0, 80) });
  // Note: DS-006 §2.3 corrected 2026-08-04 to {status,rowsAffected}; sweep-holds is the documented exception.
  return out;
}
