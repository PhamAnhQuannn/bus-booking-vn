/**
 * Circuit-breaker factory cho LLM planner-chat, PER-PROVIDER (#552 tổng quát hoá PR-4).
 *
 * Gốc chỉ có Gemini (geminiBreaker.ts, key cứng `planner-gemini:*`). A+C cần Groq + Gemini có breaker
 * RIÊNG (một provider bão 429/5xx KHÔNG được mở breaker provider kia). `createBreaker(prefix)` đóng gói
 * key `${prefix}:fails`/`${prefix}:open` + in-mem state RIÊNG theo closure (mỗi instance biến độc lập —
 * KHÔNG share module-var). Gemini = createBreaker('planner-gemini') → key literal Y HỆT bản cũ (deploy
 * KHÔNG reset breaker prod đang chạy). Groq = createBreaker('planner-groq').
 *
 * FAILS OPEN mọi lỗi Redis (breaker là tối ưu availability, KHÔNG phải cost cap — plannerDailyBudget
 * fail-closed mới là backstop chi phí). Backend qua resolveRatelimitBackend (dùng chung, không drift).
 */

import type IORedisType from 'ioredis';
import { logger } from '@/lib/logger';
import { resolveRatelimitBackend } from '@/lib/core/http/ratelimitBackend';
import { rawIoRedis, rawUpstash } from './rawRedisClient';

const THRESHOLD = 5; // consecutive-window upstream failures before opening
const WINDOW_SEC = 60; // failures must cluster within this window to count
const COOLDOWN_SEC = 60; // how long the breaker stays open once tripped

export const BREAKER_COOLDOWN_SEC = COOLDOWN_SEC;

export interface BreakerState {
  open: boolean;
  retryAfter: number; // seconds until the breaker closes (0 when closed)
}

export interface ProviderBreaker {
  breakerState: () => Promise<BreakerState>;
  recordUpstreamFailure: () => Promise<void>;
  recordUpstreamSuccess: () => Promise<void>;
}

/**
 * Tạo 1 breaker cô lập cho `prefix` (vd 'planner-gemini', 'planner-groq'). Key Redis + in-mem state
 * RIÊNG per instance → 2 provider không đụng nhau. Ngưỡng/cửa sổ/cooldown giữ nguyên bản Gemini gốc.
 * Construct once per prefix at module scope (see geminiBreaker.ts) — a second call with the same prefix
 * forks independent in-memory state under the memory backend.
 */
export function createBreaker(prefix: string): ProviderBreaker {
  const FAILS_KEY = `${prefix}:fails`;
  const OPEN_KEY = `${prefix}:open`;
  // Log-event names stay provider-scoped (`planner.gemini.breaker.*` byte-identical to the pre-factory
  // module — live dashboards grep them; Groq gets `planner.groq.breaker.*`).
  const EVT = `planner.${prefix.replace(/^planner-/, '')}.breaker`;

  // in-process fallback (dev/CI 'memory' backend) — closure-local, RIÊNG cho instance này.
  let _memFails = 0;
  let _memFailsExp = 0; // ms epoch khi cửa sổ failure reset
  let _memOpenUntil = 0; // ms epoch tới khi breaker còn mở

  async function breakerState(): Promise<BreakerState> {
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
      logger.warn({ err, backend, prefix }, `${EVT}.state_check_failed — fail-open`);
      return { open: false, retryAfter: 0 };
    }
  }

  async function recordUpstreamFailure(): Promise<void> {
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
          logger.warn({ backend, prefix }, `${EVT}.open`);
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
        logger.warn({ backend, prefix }, `${EVT}.open`);
      }
    } catch (err) {
      logger.warn({ err, backend, prefix }, `${EVT}.record_failure_failed`);
    }
  }

  async function recordUpstreamSuccess(): Promise<void> {
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
      logger.warn({ err, backend, prefix }, `${EVT}.record_success_failed`);
    }
  }

  return { breakerState, recordUpstreamFailure, recordUpstreamSuccess };
}
