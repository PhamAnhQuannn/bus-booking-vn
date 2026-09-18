/**
 * GET /api/cron/planner-llm-probe
 *
 * Vercel Cron (see vercel.json, `0 * /6 * * *` = 4×/ngày). Secured via CRON_SECRET (assertCronAuth).
 *
 * Drift probe cho tầng LLM của trợ lý du lịch (plan planner-100convday A+C). Gọi endpoint METADATA
 * models của mỗi provider (0 token generation) để phát hiện SỚM:
 *   - model_404: model pin biến mất/đổi tên (catalog churn — ladder llama cũ đã CHẾT 404).
 *   - down / auth: provider chết hoặc key sai.
 *
 * Quota: Groq MỌI lần (free 1000 RPD, ~0 chi phí) · Gemini CHỈ slot đầu ngày (giờ UTC 0) = 1/ngày —
 * metadata không tính vào quota generateContent 20/ngày nhưng vẫn giữ tối thiểu. Groq prod chưa có key
 * (SHIP DARK) → 'skipped_no_key', không alert; Gemini có key prod → probe LIVE.
 *
 * Returns: { results } 200 · 401 auth fail · 500 error.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/core/http/cronAuth';
import { probePlannerProviders, type ProviderId } from '@/trip-planner/lib/planner';
import { captureException } from '@/lib/observability';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<Response> {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    // Gemini 1/ngày: chỉ probe ở slot đầu ngày (UTC 0). Groq mọi lần. Lịch `0 */6 * * *` → UTC {0,6,12,18}.
    const providers: ProviderId[] = new Date().getUTCHours() === 0 ? ['groq', 'gemini'] : ['groq'];
    const results = await probePlannerProviders(providers);

    // model_404/down/auth = bất thường → warn (lọc alert theo level). skipped_no_key/ok = im.
    const unhealthy = results.filter((r) => r.status === 'model_404' || r.status === 'down' || r.status === 'auth');
    for (const r of unhealthy) logger.warn(r, 'planner.llm.probe.unhealthy');

    // model_404 = drift catalog (nghiêm trọng: lịch sẽ 404 khi provider này active) · auth = key prod
    // chết/bị thu hồi (Gemini là provider prod DUY NHẤT → planner tối) → page ops. down = transient, chỉ warn.
    const drift = results.filter((r) => r.status === 'model_404' || r.status === 'auth');
    if (drift.length) {
      captureException(new Error(`planner LLM model drift / auth failure: ${drift.map((d) => `${d.provider}/${d.model}/${d.status}`).join(', ')}`), {
        route: 'cron/planner-llm-probe',
        drift,
      });
    }

    logger.info({ results }, 'planner.llm.probe');
    return NextResponse.json({ results });
  } catch (err) {
    logger.error({ err }, 'planner-llm-probe: cron run failed');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
