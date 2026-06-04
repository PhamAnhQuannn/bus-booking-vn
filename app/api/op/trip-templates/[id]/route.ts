/**
 * /api/op/trip-templates/[id] — single recurring template routes (Issue 013).
 *
 * GET   — fetch template detail
 * PATCH — partial update (price, departureLocalTime, daysOfMask, validFrom, validUntil, busId, deactivatedAt)
 *
 * Cross-op → 404 not_found (I2).
 * Note: PATCH on a template does NOT affect already-generated Trip siblings (AC5).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { getTemplate, patchTemplate } from '@/lib/trips';
import { PatchRecurringTemplateSchema } from '@/lib/core/validation/trip';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (_req: NextRequest, authCtx: OperatorAuthContext) => {
      const template = await getTemplate(authCtx.operatorId, id);
      if (!template) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json({ template });
    })
  );
  return wrappedHandler(req);
}

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (request: NextRequest, authCtx: OperatorAuthContext) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
      }

      const parsed = PatchRecurringTemplateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'validation_failed', issues: parsed.error.issues }, { status: 422 });
      }

      const result = await patchTemplate(authCtx.operatorId, id, {
        price: parsed.data.price,
        departureLocalTime: parsed.data.departureLocalTime,
        daysOfMask: parsed.data.daysOfMask,
        validFrom: parsed.data.validFrom,
        validUntil: parsed.data.validUntil,
        busId: parsed.data.busId,
        deactivatedAt: parsed.data.deactivatedAt,
      });

      if (!result) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json({ template: result });
    })
  );
  return wrappedHandler(req);
}
