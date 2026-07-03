export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { runJob, sweepSessions } from '@/lib/jobs';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const result = await runJob('session-sweep', sweepSessions);
    logger.info(result, 'sweep-sessions: cron run complete');
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, 'sweep-sessions: cron run failed');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
