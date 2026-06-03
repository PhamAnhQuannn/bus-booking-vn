/**
 * POST /api/op/register — self-serve operator registration (Issue 076).
 *
 * PUBLIC: no auth (the applicant has no account yet). The proxy.ts CSRF
 * double-submit gate STILL applies (this is a non-safe /api/* POST) — the
 * /op/register GET page issues the bb_csrf cookie, the client echoes it in
 * X-CSRF-Token. We deliberately do NOT exempt this route from CSRF.
 *
 * Pipeline:
 *   1. Rate-limit per-IP (5/hour → 429 on breach) — abuse guard on a public POST.
 *   2. Parse + zod-validate the body (400 on breach).
 *   3. registerOperator() → creates PENDING_REVIEW Operator + bootstrap admin
 *      OperatorUser + enqueues the pending email.
 *   4. 201 { applicationRef }. phone_in_use → 409. Bad phone format → 400.
 *
 * Wrapped in withErrorHandler — 500s are scrubbed.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/core/db/client';
import { registerOperator } from '@/lib/onboarding/registerOperator';
import { RegisterError } from '@/lib/onboarding/errors';
import { PhoneNormalizeError } from '@/lib/core/validation/phone';
import { opRegisterRatelimit } from '@/lib/ratelimit';
import { withErrorHandler } from '@/lib/withErrorHandler';

const registerSchema = z.object({
  legalName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(1),
  password: z.string().min(8),
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

  // ---- 4. Register ----
  try {
    const { applicationRef } = await registerOperator(prisma, {
      legalName: parsed.data.legalName,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone,
      password: parsed.data.password,
      baseUrl,
    });
    return NextResponse.json({ applicationRef }, { status: 201 });
  } catch (e) {
    if (e instanceof RegisterError && e.code === 'phone_in_use') {
      return NextResponse.json({ error: 'PHONE_IN_USE' }, { status: 409 });
    }
    // Invalid phone format reaches here as PhoneNormalizeError (zod only checks
    // non-empty) — treat as a 400 validation failure.
    if (e instanceof PhoneNormalizeError) {
      return NextResponse.json({ error: 'INVALID' }, { status: 400 });
    }
    throw e;
  }
}

export const POST = withErrorHandler(handler);
