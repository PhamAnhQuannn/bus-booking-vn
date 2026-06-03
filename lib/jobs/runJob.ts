/**
 * runJob — invoke a job core under the advisory lock and write exactly one
 * JobRunLog row per invocation.
 *
 * startedAt is captured before the lock attempt. On normal return (including
 * 'skipped_locked') we write the core's status + rowsAffected. On throw we write
 * status='failed' with the error message, then rethrow so the cron route can
 * surface a 500. The JobRunLog write is OUTSIDE the lock transaction — the lock
 * tx has already committed/rolled back by the time we log, so the audit row
 * persists even when the job tx rolled back.
 *
 * Contract (lib/jobs/types.ts): the core never writes JobRunLog and never
 * produces 'failed' — 'failed' is runner-only.
 */

import { prisma } from '@/lib/core/db/client';
import { withAdvisoryLock } from './withAdvisoryLock';
import type { JobCore, JobResult } from './types';

export async function runJob(jobName: string, core: JobCore): Promise<JobResult> {
  const startedAt = new Date();

  try {
    const result = await withAdvisoryLock(jobName, core);
    await prisma.jobRunLog.create({
      data: {
        jobName,
        startedAt,
        endedAt: new Date(),
        status: result.status,
        rowsAffected: result.rowsAffected,
      },
    });
    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await prisma.jobRunLog.create({
      data: {
        jobName,
        startedAt,
        endedAt: new Date(),
        status: 'failed',
        rowsAffected: 0,
        errorMessage,
      },
    });
    throw err;
  }
}
