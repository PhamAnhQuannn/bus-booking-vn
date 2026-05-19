/**
 * DELETE /api/op/buses/[id]/maintenance/[mid] — remove a maintenance window (Issue 011).
 *
 * Scoping rules:
 *   - The bus must belong to the caller's operator (else 404 not_found).
 *   - The maintenance row must belong to the bus (else 404 not_found) — prevents
 *     cross-bus / cross-op mids from being deleted via path tampering.
 *
 * AC6: cross-op or cross-bus → 404 not_found.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth/requireOperatorAuth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/db/client';

type RouteContext = { params: Promise<{ id: string; mid: string }> };

export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id, mid } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (_request: NextRequest, authCtx: OperatorAuthContext) => {
      // Verify bus ownership.
      const bus = await prisma.bus.findFirst({
        where: { id, operatorId: authCtx.operatorId },
        select: { id: true },
      });
      if (!bus) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }

      // Verify maintenance belongs to bus.
      const maintenance = await prisma.busMaintenance.findFirst({
        where: { id: mid, busId: id },
        select: { id: true },
      });
      if (!maintenance) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }

      await prisma.busMaintenance.delete({ where: { id: mid } });

      return NextResponse.json({ ok: true });
    })
  );

  return wrappedHandler(req);
}
