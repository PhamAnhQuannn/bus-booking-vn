/**
 * Token / $ accounting cho LLM planner-chat, PER-PROVIDER (#553 tổng quát hoá PR-4).
 *
 * Gốc chỉ Gemini (geminiUsage.ts). A+C có Groq (free = $0) + Gemini (trả phí) → cần bảng giá + counter
 * RIÊNG per provider. `recordLlmUsage(provider, in, out)` key `planner-${provider}:tok-*` → Gemini giữ
 * key literal `planner-gemini:*` cũ. Groq giá $0 (free tier) — KHÔNG được tính giá Gemini (dashboard bịa
 * spend). KHÔNG gate gì (observability); FAILS OPEN mọi lỗi Redis. Ngày theo Asia/Ho_Chi_Minh.
 *
 * Giá (VERIFY tại nguồn — pricing trôi): Gemini-flash ≈ $1.50/1M in · $7.50/1M out (2026-08). Groq free = 0.
 */

import { logger } from '@/lib/logger';
import { resolveRatelimitBackend } from '@/lib/core/http/ratelimitBackend';
import { rawIoRedis, rawUpstash } from './rawRedisClient';

export type LlmProvider = 'gemini' | 'groq';

// $ / 1e6 token, per provider. Groq free-tier = 0 (KHÔNG tính giá Gemini → tránh bịa spend).
const PRICE: Record<LlmProvider, { in: number; out: number }> = {
  gemini: { in: 1.5, out: 7.5 },
  groq: { in: 0, out: 0 },
};
const RETENTION_SEC = 48 * 60 * 60; // keep a day's counters ~48h for ops to read

export interface LlmUsageResult {
  callUsd: number; // $ estimate for THIS turn
  dailyInputTokens: number; // running totals for the current VN day
  dailyOutputTokens: number;
  dailyUsd: number;
}

function usd(provider: LlmProvider, inputTokens: number, outputTokens: number): number {
  const p = PRICE[provider];
  return (inputTokens / 1e6) * p.in + (outputTokens / 1e6) * p.out;
}

/** Current calendar day in Asia/Ho_Chi_Minh (YYYY-MM-DD) — the business timezone. */
function vnDay(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// ── in-process fallback (dev/CI 'memory' backend) — key theo `${provider}:${day}` (tách provider) ──
const _mem = new Map<string, { in: number; out: number; micros: number }>();

/**
 * Record one turn's token usage cho `provider`; trả $ estimate lượt này + tổng luỹ kế ngày.
 * `micros` = $ × 1e6 giữ integer trong Redis để INCRBY exact.
 */
export async function recordLlmUsage(
  provider: LlmProvider,
  inputTokens: number,
  outputTokens: number,
): Promise<LlmUsageResult> {
  const callUsd = usd(provider, inputTokens, outputTokens);
  const callMicros = Math.round(callUsd * 1e6);
  const day = vnDay();
  const inKey = `planner-${provider}:tok-in:${day}`;
  const outKey = `planner-${provider}:tok-out:${day}`;
  const usdKey = `planner-${provider}:usd-micro:${day}`;
  const backend = resolveRatelimitBackend();

  try {
    if (backend === 'memory') {
      const memKey = `${provider}:${day}`;
      const cur = _mem.get(memKey) ?? { in: 0, out: 0, micros: 0 };
      cur.in += inputTokens;
      cur.out += outputTokens;
      cur.micros += callMicros;
      _mem.set(memKey, cur);
      return { callUsd, dailyInputTokens: cur.in, dailyOutputTokens: cur.out, dailyUsd: cur.micros / 1e6 };
    }

    const r = backend === 'ioredis' ? await rawIoRedis() : await rawUpstash();
    const [dIn, dOut, dMicros] = await Promise.all([
      r.incrby(inKey, inputTokens),
      r.incrby(outKey, outputTokens),
      r.incrby(usdKey, callMicros),
    ]);
    // Refresh TTLs so the day's counters expire ~48h after the last write (fire-and-forget).
    await Promise.all([
      r.expire(inKey, RETENTION_SEC),
      r.expire(outKey, RETENTION_SEC),
      r.expire(usdKey, RETENTION_SEC),
    ]);
    return {
      callUsd,
      dailyInputTokens: Number(dIn),
      dailyOutputTokens: Number(dOut),
      dailyUsd: Number(dMicros) / 1e6,
    };
  } catch (err) {
    // Event name stays provider-scoped (`planner.gemini.usage.*` byte-identical to the pre-factory module).
    logger.warn({ err, backend, provider }, `planner.${provider}.usage.record_failed — accounting only, ignored`);
    // Fail-open: still return this call's estimate so the caller's per-turn log line is complete.
    return { callUsd, dailyInputTokens: inputTokens, dailyOutputTokens: outputTokens, dailyUsd: callUsd };
  }
}
