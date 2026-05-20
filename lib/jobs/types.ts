/**
 * Shared types for the Issue 019 cron-job cores (lib/jobs/*).
 *
 * Each job core is a pure-ish function that runs inside a single advisory-locked
 * transaction and returns a JobResult. The core does NOT write JobRunLog — the
 * cron route writes exactly one JobRunLog row per invocation (success + catch).
 */

import type { Prisma } from '@prisma/client';

export interface JobResult {
  rowsAffected: number;
  status: 'success' | 'skipped_locked';
  errorMessage?: string;
}

/**
 * Clock-injection options. Defaults to `new Date()` resolved in the function
 * body (NOT a param default — keeps the core a pure function of its inputs per
 * the Issue 016 RSC-purity rule, and lets integration tests pin the window).
 */
export interface JobOpts {
  now?: Date;
}

/**
 * A job core: runs inside the advisory-locked transaction, receives the tx
 * handle (for raw SQL + writes), and returns a JobResult. Never writes
 * JobRunLog itself (runJob owns that) and never returns 'skipped_locked'
 * (withAdvisoryLock owns that).
 */
export type JobCore = (
  tx: Prisma.TransactionClient,
  opts?: JobOpts
) => Promise<JobResult>;
