/**
 * GET /api/ping — pure liveness probe. NO database, NO Redis, NO external call.
 *
 * This is the endpoint the uptime monitor (BetterStack/UptimeRobot) should poll
 * at high frequency. Unlike `/api/health` (which runs a Prisma `SELECT 1`), this
 * route never touches Neon — so a 60s monitor cannot keep Neon compute awake and
 * burn compute-hours. See `/api/health` for the DB-readiness probe, which should
 * be monitored rarely (15–30 min).
 *
 * Runtime is `edge`: Prisma is not Edge-safe, so a future accidental DB import
 * here fails the build instead of silently reintroducing the compute-burn.
 * `Cache-Control: no-store` so the monitor always reaches the function.
 */

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export function GET(): NextResponse {
  return NextResponse.json({ status: 'ok' }, { status: 200, headers: NO_STORE });
}
