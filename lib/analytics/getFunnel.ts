/**
 * getFunnel — distinct-session counts per funnel step over a VN-tz date window,
 * with step-over-step conversion + drop-off. Powers the funnel widget on the
 * operator overview dashboard.
 *
 * Note: this is a platform-wide funnel (anonymous sessions are not operator-scoped),
 * so it reflects the whole marketplace, not a single operator's slice.
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import { FUNNEL_STEPS, type FunnelStep } from './track';

const STEP_LABEL: Record<FunnelStep, string> = {
  search_performed: 'Tìm chuyến',
  hold_created: 'Giữ chỗ',
  payment_initiated: 'Bắt đầu thanh toán',
  booking_paid: 'Thanh toán xong',
};

export interface FunnelStepResult {
  step: FunnelStep;
  label: string;
  sessions: number;
  /** % of the first step (search). */
  conversionPct: number;
  /** % lost vs the previous step. */
  dropPct: number;
}

export interface GetFunnelInput {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;
}

export async function getFunnel(input: GetFunnelInput): Promise<FunnelStepResult[]> {
  const windowStart = new Date(`${input.dateFrom}T00:00:00+07:00`);
  const windowEnd = new Date(`${input.dateTo}T23:59:59+07:00`);

  const rows = await prisma.$queryRaw<{ step: string; sessions: number }[]>(
    Prisma.sql`
      SELECT step, COUNT(DISTINCT "sessionId")::int AS sessions
      FROM "FunnelEvent"
      WHERE "createdAt" >= ${windowStart}
        AND "createdAt" <= ${windowEnd}
      GROUP BY step
    `
  );

  const countByStep = new Map(rows.map((r) => [r.step, r.sessions]));
  const top = countByStep.get(FUNNEL_STEPS[0]) ?? 0;

  let prev = 0;
  return FUNNEL_STEPS.map((step, i) => {
    const sessions = countByStep.get(step) ?? 0;
    const conversionPct = top > 0 ? Math.round((sessions / top) * 100) : 0;
    const dropPct = i === 0 || prev === 0 ? 0 : Math.round((1 - sessions / prev) * 100);
    prev = sessions;
    return { step, label: STEP_LABEL[step], sessions, conversionPct, dropPct };
  });
}
