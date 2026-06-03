/**
 * Fire-and-forget conversion-funnel event logging.
 *
 * Mirrors the createNotificationLog contract: best-effort, NEVER throws, never
 * blocks the request path. A failed insert is logged at warn and swallowed —
 * analytics must not break a booking.
 */

import { prisma } from '@/lib/core/db/client';
import { logger } from '@/lib/logger';

export const FUNNEL_STEPS = [
  'search_performed',
  'hold_created',
  'payment_initiated',
  'booking_paid',
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export interface TrackInput {
  /** Anonymous session id (bb_sid cookie). Skips the write when absent. */
  sessionId: string | null | undefined;
  tripId?: string | null;
  bookingId?: string | null;
  context?: Record<string, unknown>;
}

/** Read the anonymous funnel session id from a request's cookies. */
export function sessionIdFromRequest(req: { cookies: { get(name: string): { value: string } | undefined } }): string | null {
  return req.cookies.get('bb_sid')?.value ?? null;
}

/**
 * Resolve the session that initiated a booking. The payment webhook is a
 * server-to-server call with no user cookie, so booking_paid correlates back via
 * the bookingId recorded on the earlier payment_initiated event. Best-effort.
 */
export async function sessionIdForBooking(bookingId: string): Promise<string | null> {
  try {
    const row = await prisma.funnelEvent.findFirst({
      where: { bookingId, sessionId: { not: '' } },
      orderBy: { createdAt: 'desc' },
      select: { sessionId: true },
    });
    return row?.sessionId ?? null;
  } catch {
    return null;
  }
}

export async function track(step: FunnelStep, input: TrackInput): Promise<void> {
  if (!input.sessionId) return; // no session → nothing to correlate
  try {
    await prisma.funnelEvent.create({
      data: {
        step,
        sessionId: input.sessionId,
        tripId: input.tripId ?? null,
        bookingId: input.bookingId ?? null,
        context: (input.context ?? undefined) as never,
      },
    });
  } catch (err) {
    logger.warn({ err, step }, 'funnel track failed (ignored)');
  }
}
