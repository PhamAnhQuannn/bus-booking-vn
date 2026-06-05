/**
 * POST /api/admin/system/flags (Issue 070) — toggle a runtime feature flag.
 *
 * Rail toggles + kill-switches are operationally sensitive (they can disable the
 * whole booking/search flow or a payment rail), so this route requires an
 * AUTHENTICATED + TOTP-verified SUPER_ADMIN | FINANCE composed with a FRESH step-up
 * (requireStepUp) — same gate posture as the Finance routes (Issue 068).
 *
 * Body: { key, enabled, value? }. The key MUST be one of FLAG_KEYS (unknown keys →
 * 422) so a typo can't create a phantom always-default-false flag row. setFlag
 * upserts the row AND appends the AdminAuditLog entry in one transaction (audited
 * internally — no separate writeAdminAuditLog here). 200 { ok: true }.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/core/db/client';
import { requireAdminAuth, type AdminAuthContext } from '@/lib/auth';
import { requireStepUp } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { setFlag } from '@/lib/flags';
import { FLAG_KEYS } from '@/lib/flags';

const KNOWN_KEYS = new Set<string>(Object.values(FLAG_KEYS));

const bodySchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  value: z.string().optional(),
});

async function handler(req: NextRequest, ctx: AdminAuthContext): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  // Reject unknown keys — only the canonical FLAG_KEYS may be set.
  if (!KNOWN_KEYS.has(parsed.data.key)) {
    return NextResponse.json({ error: 'UNKNOWN_FLAG' }, { status: 422 });
  }

  await setFlag(prisma, {
    key: parsed.data.key,
    enabled: parsed.data.enabled,
    value: parsed.data.value ?? null,
    actor: `admin:${ctx.adminId}`,
  });

  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandler(
  requireAdminAuth({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] })(
    requireStepUp(handler)
  ) as (req: NextRequest) => Promise<Response>
);
