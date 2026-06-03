/**
 * POST /api/charter/[ref]/cancel — public, ref-keyed customer cancel (Issue 082).
 *
 * PUBLIC: the ref (CH-YYYY-XXXXXX, 36^6 ≈ 2.1B/year) is the access key — anyone
 * with the customer's status link can cancel. Acceptable for a lead-gen request
 * (no payment, no PII beyond the customer's own submitted contact details). The
 * proxy.ts CSRF double-submit gate STILL applies; the status page GET issues the
 * bb_csrf cookie and the CancelCharterButton echoes it in X-CSRF-Token.
 *
 * Customer cancel is only legal PRE-ACCEPT (AC4): SUBMITTED / ADMIN_REVIEW /
 * ASSIGNED_DIRECT / PUBLISHED (CUSTOMER_CANCELLABLE_STATUSES). Once an operator
 * has ACCEPTED — or the request is already terminal — the customer cannot cancel:
 * we return 422 (cannot_cancel) BEFORE calling transitionCharterRequest, so the
 * 081 state machine's ACCEPTED → CANCELLED edge (reserved for admin/operator
 * teardown) is never reached from this route.
 *
 *   404 — no charter with this ref.
 *   422 — status is not customer-cancellable (ACCEPTED / terminal).
 *   200 — { ref, status: 'CANCELLED' }.
 *
 * Wrapped in withErrorHandler — 500s scrubbed.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/core/db/client';
import {
  transitionCharterRequest,
  getCharterByRef,
  CUSTOMER_CANCELLABLE_STATUSES,
  CharterError,
} from '@/lib/charter';
import { withErrorHandler } from '@/lib/withErrorHandler';

type RouteContext = { params: Promise<{ ref: string }> };

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const wrapped = withErrorHandler(async () => {
    const { ref } = await ctx.params;

    const charter = await getCharterByRef(prisma, ref);
    if (!charter) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    // Customer cancel is pre-ACCEPT only (AC4). Gate here so we never reach the
    // ACCEPTED → CANCELLED edge (admin/operator teardown) from this route.
    if (!CUSTOMER_CANCELLABLE_STATUSES.has(charter.status)) {
      return NextResponse.json({ error: 'CANNOT_CANCEL' }, { status: 422 });
    }

    try {
      const result = await transitionCharterRequest(prisma, {
        charterId: charter.id,
        to: 'CANCELLED',
      });
      return NextResponse.json({ ref, status: result.to }, { status: 200 });
    } catch (e) {
      // Race: status moved to ACCEPTED/terminal between the read and the locked
      // transition — the FOR UPDATE re-evaluates the edge and rejects it.
      if (e instanceof CharterError && e.code === 'illegal_transition') {
        return NextResponse.json({ error: 'CANNOT_CANCEL' }, { status: 422 });
      }
      throw e;
    }
  });

  return wrapped(req);
}
