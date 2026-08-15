/**
 * Token / $ accounting for the Gemini planner chat (#553).
 *
 * The budget cap (plannerDailyBudget) counts REQUESTS, a weak proxy for spend. This captures the
 * real token usage Gemini returns per turn (usageMetadata), converts it to a $ estimate, and
 * accumulates a daily running total so ops can see actual spend — the pre-billing prerequisite that
 * pairs with the fail-closed budget before paid billing is enabled. It does NOT gate anything today
 * (a $-ceiling gate is a follow-up); it observes.
 *
 * Prices: gemini-flash-latest ≈ $1.50 / 1M input tokens · $7.50 / 1M output tokens (2026-08, see
 * trip-planner/prerequisites/cost-model.md). VERIFY at source before acting on the numbers — API
 * pricing drifts. Daily totals key on the Asia/Ho_Chi_Minh calendar day (business timezone).
 *
 * FAILS OPEN — accounting is observability, not a gate. Any Redis error is swallowed; the caller
 * still gets this call's own estimate so the per-turn log line is never lost.
 */

import { logger } from '@/lib/logger';
import { resolveRatelimitBackend } from '@/lib/core/http/ratelimitBackend';
import { rawIoRedis, rawUpstash } from './rawRedisClient';

const USD_PER_M_INPUT = 1.5;
const USD_PER_M_OUTPUT = 7.5;
const RETENTION_SEC = 48 * 60 * 60; // keep a day's counters ~48h for ops to read

export interface GeminiUsageResult {
  callUsd: number; // $ estimate for THIS turn
  dailyInputTokens: number; // running totals for the current VN day
  dailyOutputTokens: number;
  dailyUsd: number;
}

function usd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1e6) * USD_PER_M_INPUT + (outputTokens / 1e6) * USD_PER_M_OUTPUT;
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

// ── in-process fallback (dev/CI 'memory' backend) ──
const _mem = new Map<string, { in: number; out: number; micros: number }>();

/**
 * Record one turn's token usage; returns this call's $ estimate + the running daily totals.
 * `micros` = $ × 1e6 kept as an integer in Redis so INCRBY stays exact.
 */
export async function recordGeminiUsage(
  inputTokens: number,
  outputTokens: number,
): Promise<GeminiUsageResult> {
  const callUsd = usd(inputTokens, outputTokens);
  const callMicros = Math.round(callUsd * 1e6);
  const day = vnDay();
  const inKey = `planner-gemini:tok-in:${day}`;
  const outKey = `planner-gemini:tok-out:${day}`;
  const usdKey = `planner-gemini:usd-micro:${day}`;
  const backend = resolveRatelimitBackend();

  try {
    if (backend === 'memory') {
      const cur = _mem.get(day) ?? { in: 0, out: 0, micros: 0 };
      cur.in += inputTokens;
      cur.out += outputTokens;
      cur.micros += callMicros;
      _mem.set(day, cur);
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
    logger.warn({ err, backend }, 'planner.gemini.usage.record_failed — accounting only, ignored');
    // Fail-open: still return this call's estimate so the caller's per-turn log line is complete.
    return { callUsd, dailyInputTokens: inputTokens, dailyOutputTokens: outputTokens, dailyUsd: callUsd };
  }
}
