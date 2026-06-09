/**
 * POST /api/op/register — public operator APPLICATION (Issue 076; reworked 2026-06-06).
 *
 * PUBLIC: no auth (the applicant has no account yet). The proxy.ts CSRF
 * double-submit gate STILL applies (this is a non-safe /api/* POST) — the
 * /op/register GET page issues the bb_csrf cookie, the client echoes it in
 * X-CSRF-Token. We deliberately do NOT exempt this route from CSRF.
 *
 * 2026-06-06: application-only. NO password is accepted and NO login account is
 * created here — a platform admin provisions the account later.
 *
 * Pipeline:
 *   1. Rate-limit per-IP (5/hour → 429 on breach) — abuse guard on a public POST.
 *   2. Parse + zod-validate the body (400 on breach).
 *   3. registerOperator() → creates PENDING_REVIEW Operator + enqueues pending email.
 *   4. 201 { applicationRef }. Bad phone format → 400.
 *
 * Wrapped in withErrorHandler — 500s are scrubbed.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/core/db/client';
import { registerOperator } from '@/lib/onboarding';
import { PhoneNormalizeError } from '@/lib/core/validation/phone';
import { opRegisterRatelimit } from '@/lib/ratelimit';
import { withErrorHandler } from '@/lib/withErrorHandler';

const registerSchema = z.object({
  brandName: z.string().trim().min(1).max(120),
  legalName: z.string().trim().min(1).max(200),
  contactName: z.string().trim().min(1).max(120),
  contactPhone: z.string().min(1),
  contactEmail: z.string().email(),
  address: z.string().trim().min(1).max(300),
  routesSummary: z.string().trim().min(1).max(500),
  // Issue 105: operator base province (GSO code + name from lib/geo). Optional.
  provinceCode: z.string().trim().min(1).max(10).optional(),
  provinceName: z.string().trim().min(1).max(120).optional(),
});

async function handler(req: NextRequest): Promise<Response> {
  // ---- 1. Rate limit by IP ----
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

  const rl = await opRegisterRatelimit.limit(`op-register:${ip}`);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rl.retryAfter),
        'X-RateLimit-Remaining': '0',
      },
    });
  }

  // ---- 2. Parse + validate ----
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  // ---- 3. Derive baseUrl from the request (never a static env fallback) ----
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3001';
  const baseUrl = `${proto}://${host}`;

  // ---- 4. Create application ----
  try {
    const { applicationRef } = await registerOperator(prisma, {
      brandName: parsed.data.brandName,
      legalName: parsed.data.legalName,
      contactName: parsed.data.contactName,
      contactPhone: parsed.data.contactPhone,
      contactEmail: parsed.data.contactEmail,
      address: parsed.data.address,
      routesSummary: parsed.data.routesSummary,
      provinceCode: parsed.data.provinceCode,
      provinceName: parsed.data.provinceName,
      baseUrl,
    });
    return NextResponse.json({ applicationRef }, { status: 201 });
  } catch (e) {
    // Invalid phone format reaches here as PhoneNormalizeError (zod only checks
    // non-empty) — treat as a 400 validation failure.
    if (e instanceof PhoneNormalizeError) {
      return NextResponse.json({ error: 'INVALID' }, { status: 400 });
    }
    throw e;
  }
}

export const POST = withErrorHandler(handler);
