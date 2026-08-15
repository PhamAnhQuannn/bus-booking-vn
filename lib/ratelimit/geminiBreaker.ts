/**
 * Circuit-breaker for the Gemini planner chat (#552).
 *
 * During an upstream 429/5xx storm (account quota already exhausted, or a provider incident) every
 * request would still issue a full Gemini call — consuming a per-minute + daily budget slot — before
 * failing, burning the local budget on calls that were doomed. After THRESHOLD failures inside a
 * WINDOW the breaker OPENS: /api/planner/chat short-circuits to a fast 503 for COOLDOWN_SEC without
 * calling Gemini. One successful turn clears the failure counter; the open flag self-expires (TTL),
 * so the next request after the cooldown probes the upstream again (half-open via TTL).
 *
 * FAILS OPEN on any Redis error — the breaker is an availability optimization, NOT the cost cap. The
 * fail-CLOSED plannerDailyBudget (#548) stays the spend backstop, so a Redis blip must not ALSO
 * disable the assistant. Backend chosen through the ONE shared predicate (resolveRatelimitBackend)
 * that createRatelimit + consumeJti use, so the selection never drifts.
 */

import type IORedisType from 'ioredis';
import { logger } from '@/lib/logger';
import { resolveRatelimitBackend } from '@/lib/core/http/ratelimitBackend';
import { rawIoRedis, rawUpstash } from './rawRedisClient';

const FAILS_KEY = 'planner-gemini:fails';
const OPEN_KEY = 'planner-gemini:open';
const THRESHOLD = 5; // consecutive-window upstream failures before opening
const WINDOW_SEC = 60; // failures must cluster within this window to count
const COOLDOWN_SEC = 60; // how long the breaker stays open once tripped

export interface BreakerState {
  open: boolean;
  retryAfter: number; // seconds until the breaker closes (0 when closed)
}

export const BREAKER_COOLDOWN_SEC = COOLDOWN_SEC;

// ── in-process fallback (dev/CI 'memory' backend — single instance, so per-process state is fine) ──
let _memFails = 0;
let _memFailsExp = 0; // ms epoch when the failure window resets
let _memOpenUntil = 0; // ms epoch until which the breaker is open

/** Is the breaker currently open? Fail-open (closed) on any backend error. */
export async function breakerState(): Promise<BreakerState> {
  const backend = resolveRatelimitBackend();
  try {
    if (backend === 'memory') {
      const ttl = _memOpenUntil > Date.now() ? Math.ceil((_memOpenUntil - Date.now()) / 1000) : 0;
      return { open: ttl > 0, retryAfter: ttl };
    }
    const r = backend === 'ioredis' ? await rawIoRedis() : await rawUpstash();
    const ttl = await r.ttl(OPEN_KEY); // -2 = no key, -1 = no expiry, >=0 = seconds left
    return { open: ttl > 0, retryAfter: ttl > 0 ? ttl : 0 };
  } catch (err) {
    logger.warn({ err, backend }, 'planner.gemini.breaker.state_check_failed — fail-open');
    return { open: false, retryAfter: 0 };
  }
}

/** Record one upstream (Gemini) failure; trip the breaker once THRESHOLD is reached in-window. */
export async function recordUpstreamFailure(): Promise<void> {
  const backend = resolveRatelimitBackend();
  try {
    if (backend === 'memory') {
      const now = Date.now();
      if (_memFailsExp <= now) {
        _memFails = 0;
        _memFailsExp = now + WINDOW_SEC * 1000;
      }
      _memFails += 1;
      if (_memFails >= THRESHOLD) {
        _memOpenUntil = now + COOLDOWN_SEC * 1000;
        _memFails = 0;
        _memFailsExp = 0;
        logger.warn({ backend }, 'planner.gemini.breaker.open');
      }
      return;
    }
    const r = backend === 'ioredis' ? await rawIoRedis() : await rawUpstash();
    const n = await r.incr(FAILS_KEY);
    if (n === 1) await r.expire(FAILS_KEY, WINDOW_SEC); // start the window on the first failure
    if (n >= THRESHOLD) {
      if (backend === 'ioredis') await (r as IORedisType).set(OPEN_KEY, '1', 'EX', COOLDOWN_SEC);
      else await (r as Awaited<ReturnType<typeof rawUpstash>>).set(OPEN_KEY, '1', { ex: COOLDOWN_SEC });
      await r.del(FAILS_KEY);
      logger.warn({ backend }, 'planner.gemini.breaker.open');
    }
  } catch (err) {
    logger.warn({ err, backend }, 'planner.gemini.breaker.record_failure_failed');
  }
}

/** A healthy turn — clear the failure counter (the open flag, if any, self-expires via TTL). */
export async function recordUpstreamSuccess(): Promise<void> {
  const backend = resolveRatelimitBackend();
  try {
    if (backend === 'memory') {
      _memFails = 0;
      _memFailsExp = 0;
      return;
    }
    const r = backend === 'ioredis' ? await rawIoRedis() : await rawUpstash();
    await r.del(FAILS_KEY);
  } catch (err) {
    logger.warn({ err, backend }, 'planner.gemini.breaker.record_success_failed');
  }
}
