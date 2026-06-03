/**
 * POST /api/charter — public customer charter ("thuê xe hợp đồng") request submit.
 *
 * PUBLIC (Issue 082): no auth required — a guest may submit. If a customer session
 * is present we attach the customerId via an OPTIONAL auth read (getCustomerOptional)
 * — we never REQUIRE it. The proxy.ts CSRF double-submit gate STILL applies (this is
 * a non-safe /api/* POST); the /lien-he-dat-xe GET issues the bb_csrf cookie and the
 * client echoes it in X-CSRF-Token. We do NOT exempt this route from CSRF.
 *
 * Pipeline:
 *   1. Rate-limit per-IP (5/hour → 429) — volume cap on the public POST.
 *   2. Parse + zod-validate (400 on a bad body).
 *   3. HONEYPOT spam guard: a hidden field (`company`) that legit humans leave
 *      empty. If it's filled, a bot tripped it → return 200 OK and DROP silently
 *      (no row, no notification). We return 200 (not 4xx) so we don't tip the bot
 *      that the honeypot was detected.
 *   4. createCharterRequest() → resolves origin Place, stores destinations, mints
 *      a ref, creates the ADMIN_REVIEW row, enqueues the confirmation.
 *   5. 201 { ref }.
 *
 * Wrapped in withErrorHandler — 500s are scrubbed.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/core/db/client';
import { createCharterRequest } from '@/lib/charter';
import { getCustomerOptional } from '@/lib/auth/requireCustomerAuth';
import { charterRatelimit } from '@/lib/ratelimit';
import { withErrorHandler } from '@/lib/withErrorHandler';

const charterSchema = z.object({
  contactName: z.string().trim().min(1).max(120),
  contactPhone: z.string().trim().min(1).max(20),
  contactEmail: z.string().trim().email(),
  originName: z.string().trim().min(1).max(120),
  destinationNames: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  // ISO date (YYYY-MM-DD) from the form's DatePicker.
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  durationDays: z.number().int().min(1).max(60).optional().nullable(),
  passengers: z.number().int().min(1).max(100),
  vehicleType: z.string().trim().min(1).max(60),
  budgetVnd: z.number().int().min(0).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  // Honeypot: must be empty. A non-empty value means a bot filled the hidden field.
  company: z.string().optional(),
});

/** Parse a YYYY-MM-DD (or full ISO) string to a Date; null on an unparseable value. */
function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function handler(req: NextRequest): Promise<Response> {
  // ---- 1. Rate limit by IP ----
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const rl = await charterRatelimit.limit(`charter:${ip}`);
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

  const parsed = charterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  // ---- 3. Honeypot spam guard ----
  // A filled hidden field = bot. Return 200 OK and silently drop (don't tip the
  // bot, don't create a row). Real users never see/fill `company`.
  if (parsed.data.company && parsed.data.company.trim().length > 0) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const startDate = parseDate(parsed.data.startDate);
  if (!startDate) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  // ---- 4. Optional customer attach (never required) ----
  const customerId = await getCustomerOptional(req);

  // ---- 5. Create ----
  const { ref } = await createCharterRequest(prisma, {
    customerId,
    contactName: parsed.data.contactName,
    contactPhone: parsed.data.contactPhone,
    contactEmail: parsed.data.contactEmail,
    originName: parsed.data.originName,
    destinationNames: parsed.data.destinationNames,
    startDate,
    endDate: parseDate(parsed.data.endDate),
    durationDays: parsed.data.durationDays ?? null,
    passengers: parsed.data.passengers,
    vehicleType: parsed.data.vehicleType,
    budgetVnd: parsed.data.budgetVnd ?? null,
    notes: parsed.data.notes ?? null,
  });

  return NextResponse.json({ ref }, { status: 201 });
}

export const POST = withErrorHandler(handler);
