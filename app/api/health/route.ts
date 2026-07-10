/**
 * GET /api/health — liveness + cheap DB readiness probe (Issue 061, AC1).
 *
 * No auth. `Cache-Control: no-store` so a load balancer / uptime monitor never
 * gets a cached result. Runs on the Node runtime (Prisma is not Edge-safe).
 *
 * Liveness is implicit (the process answered). Readiness is a CHEAP DB ping —
 * `SELECT 1` — wrapped in try/catch:
 *   ping resolves → 200 { status:'ok' }
 *   ping throws   → 503 { status:'degraded' }
 *
 * Redis: there is no app-wide Redis client wired for a liveness ping (rate-limit
 * uses @upstash/ratelimit lazily per-route, no shared health handle), so the
 * Redis ping is intentionally SKIPPED here. Add a `redis` field if/when a shared
 * client lands.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(): Promise<NextResponse> {
  try {
    // Cheap readiness ping. Prisma.sql tagged template avoids any string interp.
    await prisma.$queryRaw(Prisma.sql`SELECT 1`);
    return NextResponse.json(
      { status: 'ok' },
      { status: 200, headers: NO_STORE }
    );
  } catch {
    return NextResponse.json(
      { status: 'degraded' },
      { status: 503, headers: NO_STORE }
    );
  }
}
