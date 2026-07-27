/**
 * Ratelimit factory — exports Ratelimit interface + three backends:
 *   InMemoryRatelimit  — dev/CI default (no external deps)
 *   UpstashRatelimit   — Vercel/serverless via @upstash/ratelimit (HTTP REST)
 *   IoRedisRatelimit   — self-hosted Redis via ioredis (TCP, sliding window via Lua)
 *
 * Selection: REDIS_PROVIDER env var → 'ioredis' | 'upstash' | default (in-memory).
 */

import type { Ratelimit as UpstashRatelimitClient } from '@upstash/ratelimit';
import type Redis from 'ioredis';
import { logger } from '@/lib/logger';
import { resolveRatelimitBackend } from '@/lib/core/http/ratelimitBackend';

export interface RatelimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds until window resets
}

export interface Ratelimit {
  limit(identifier: string): Promise<RatelimitResult>;
}

export interface InMemoryRatelimitOptions {
  /** Maximum number of requests per window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

/**
 * Map-based in-process rate limiter for development and CI.
 * Thread-safe within a single Node.js event loop; not suitable for
 * multi-instance production use (use UpstashRatelimit for that).
 */
export class InMemoryRatelimit implements Ratelimit {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly windows: Map<string, WindowEntry>;

  constructor(options: InMemoryRatelimitOptions) {
    this.maxRequests = options.limit;
    this.windowMs = options.windowMs;
    this.windows = new Map();
  }

  async limit(identifier: string): Promise<RatelimitResult> {
    const now = Date.now();
    const entry = this.windows.get(identifier);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      // New window
      this.windows.set(identifier, { count: 1, windowStart: now });
      return { allowed: true, remaining: this.maxRequests - 1, retryAfter: 0 };
    }

    if (entry.count < this.maxRequests) {
      entry.count++;
      return { allowed: true, remaining: this.maxRequests - entry.count, retryAfter: 0 };
    }

    // Rate limited
    const windowEnd = entry.windowStart + this.windowMs;
    const retryAfterMs = windowEnd - now;
    const retryAfterSecs = Math.ceil(retryAfterMs / 1000);
    return { allowed: false, remaining: 0, retryAfter: retryAfterSecs };
  }
}

/**
 * Production rate limiter backed by Upstash Redis.
 * Uses sliding window algorithm via @upstash/ratelimit.
 */
export class UpstashRatelimit implements Ratelimit {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private rl: UpstashRatelimitClient | null = null;

  constructor(options: InMemoryRatelimitOptions) {
    this.maxRequests = options.limit;
    this.windowMs = options.windowMs;
  }

  private async getClient() {
    if (this.rl !== null) return this.rl;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('Upstash env vars not configured');

    // Lazy import to avoid loading Upstash in CI/dev without env vars
    const { Ratelimit: UpstashRL } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({ url, token });
    const windowStr = `${Math.round(this.windowMs / 60_000)} m` as `${number} m`;
    this.rl = new UpstashRL({
      redis,
      limiter: UpstashRL.slidingWindow(this.maxRequests, windowStr),
    });
    return this.rl;
  }

  /**
   * FAILS OPEN, matching IoRedisRatelimit below — deliberately, and the deliberation
   * matters because it is the opposite of what consumeJti does one module over.
   *
   * A rate limiter is a throttle, not an authorisation gate: if it cannot reach
   * Upstash the safe move is to let traffic through, because proxy.ts awaits this
   * call for EVERY non-safe /api/* request before routing. Without the catch, one
   * Upstash REST timeout 500s the whole surface — holds, bookings, login, and the
   * SePay webhook, which is not rate-limit-exempt. SePay then marks the delivery
   * failed and retries on Fibonacci backoff over ~5h while real customer money sits
   * unconfirmed. Bank transfer is the only live rail, so an Upstash hiccup would be
   * a revenue outage.
   *
   * The cost of failing open is that abuse throttling is off for the duration of an
   * Upstash outage (including the per-session hold caps that ride this limiter).
   * Degraded, not breached — no authentication decision is made here.
   *
   * Replay guards must NOT copy this: see consumeJti in lib/auth/otpProof.ts, which
   * fails CLOSED for exactly the same outage.
   */
  async limit(identifier: string): Promise<RatelimitResult> {
    try {
      const client = await this.getClient();
      const result = await client.limit(identifier);
      const now = Date.now();
      const retryAfterSecs = result.success
        ? 0
        : Math.max(0, Math.ceil((result.reset - now) / 1000));
      return {
        allowed: result.success,
        remaining: result.remaining,
        retryAfter: retryAfterSecs,
      };
    } catch (err) {
      // Drop the memoised client so the next request rebuilds it (mirrors the
      // ioredis branch) — a bad client should not be cached past the incident.
      this.rl = null;
      logger.error({ err, identifier }, 'ratelimit.upstash.limit_failed — fail-open');
      return { allowed: true, remaining: 0, retryAfter: 0 };
    }
  }
}

/**
 * Self-hosted Redis rate limiter via ioredis (TCP).
 * Sliding window counter implemented with a Lua script (atomic INCR + PEXPIRE).
 */
export class IoRedisRatelimit implements Ratelimit {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private client: Redis | null = null;
  private _connecting: Promise<Redis> | null = null;

  constructor(options: InMemoryRatelimitOptions) {
    this.maxRequests = options.limit;
    this.windowMs = options.windowMs;
  }

  private async getClient(): Promise<Redis> {
    if (this.client) return this.client;
    if (this._connecting) return this._connecting;
    this._connecting = (async () => {
      const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
      const { default: IORedis } = await import('ioredis');
      const redis = new IORedis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
      try {
        await redis.connect();
      } catch (err) {
        this._connecting = null;
        logger.error({ err }, 'ratelimit.ioredis.connect_failed');
        throw err;
      }
      this.client = redis;
      return redis;
    })();
    return this._connecting;
  }

  // INCR-first Lua script: atomically increment then gate — eliminates the GET→INCR TOCTOU
  // race where two concurrent requests both see count < limit and both get allowed on the
  // last available slot, letting through limit+1 requests total.
  private static LUA_SCRIPT = `
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then
      redis.call('PEXPIRE', KEYS[1], ARGV[2])
    end
    if current <= tonumber(ARGV[1]) then
      return {1, tonumber(ARGV[1]) - current, 0}
    else
      local ttl = redis.call('PTTL', KEYS[1])
      if ttl < 0 then
        redis.call('PEXPIRE', KEYS[1], ARGV[2])
        ttl = tonumber(ARGV[2])
      end
      return {0, 0, ttl}
    end
  `;

  async limit(identifier: string): Promise<RatelimitResult> {
    let redis: Redis;
    try {
      redis = await this.getClient();
    } catch (err) {
      logger.error({ err, identifier }, 'ratelimit.ioredis.getClient_failed — fail-open');
      return { allowed: true, remaining: 0, retryAfter: 0 };
    }
    try {
      const result = await redis.eval(
        IoRedisRatelimit.LUA_SCRIPT,
        1,
        `rl:${identifier}`,
        this.maxRequests,
        this.windowMs,
      ) as [number, number, number];
      const allowed = result[0] === 1;
      const retryAfter = allowed ? 0 : Math.ceil(result[2] / 1000);
      if (!allowed) {
        logger.warn({ identifier, retryAfter }, 'ratelimit.denied');
      }
      return {
        allowed,
        remaining: result[1],
        retryAfter,
      };
    } catch (err) {
      this.client = null;
      this._connecting = null;
      logger.error({ err, identifier }, 'ratelimit.ioredis.eval_failed — fail-open, will reconnect');
      return { allowed: true, remaining: 0, retryAfter: 0 };
    }
  }
}

/**
 * Factory that returns the appropriate Ratelimit implementation
 * based on the runtime environment.
 *
 * - REDIS_PROVIDER=ioredis         → IoRedisRatelimit (self-hosted Redis)
 * - REDIS_PROVIDER=upstash (or Upstash env vars set) → UpstashRatelimit
 * - Default (no provider / no vars) → InMemoryRatelimit
 *
 * The choice itself lives in resolveRatelimitBackend (lib/core/http) so the boot
 * warning about in-memory-in-production is computed from the SAME predicate this
 * factory uses. Re-deriving it there would let the two drift, and a warning that
 * fires when the backend is actually fine is worse than none.
 */
export function createRatelimit(options: InMemoryRatelimitOptions): Ratelimit {
  switch (resolveRatelimitBackend()) {
    case 'ioredis':
      return new IoRedisRatelimit(options);
    case 'upstash':
      return new UpstashRatelimit(options);
    default:
      return new InMemoryRatelimit(options);
  }
}

/** Default shared ratelimit: 60 requests/min/IP */
export const ratelimit = createRatelimit({ limit: 60, windowMs: 60_000 });

/** Operator forgot-password OTP send: 3 per 15 min per phone (Issue 010) */
export const opForgotPasswordRatelimit = createRatelimit({ limit: 3, windowMs: 15 * 60_000 });

/** Self-serve operator registration: 5 per hour per IP (Issue 076) — abuse guard
 *  on the public, unauthenticated /api/op/register POST. Keyed `op-register:<ip>`. */
export const opRegisterRatelimit = createRatelimit({ limit: 5, windowMs: 60 * 60_000 });

/** Public charter (thuê xe hợp đồng) request submit: 5 per hour per IP (Issue 082)
 *  — abuse guard on the public, unauthenticated /api/charter POST. Keyed
 *  `charter:<ip>`. (Honeypot is the first-line spam guard; this caps volume.) */
export const charterRatelimit = createRatelimit({ limit: 5, windowMs: 60 * 60_000 });

/**
 * Admin TOTP verify attempt throttle: 10 per minute per admin (Issue 055).
 * General request-rate guard on the verify/step-up surface, keyed `admin-totp:<adminId>`.
 */
export const adminTotpRatelimit = createRatelimit({ limit: 10, windowMs: 60_000 });

/**
 * Admin TOTP consecutive-failure lockout: 5 bad codes per 15 min per admin (Issue 055,
 * mirrors the Issue 010 lockout idea). Keyed `admin-totp-fail:<adminId>` and consumed
 * (`.limit`) ONLY on a bad code — once exhausted the verify/step-up routes return 429
 * for the rest of the 15-min window. A successful verify does not reset the counter,
 * but a correct code is accepted before the lockout limiter is consumed, so a legitimate
 * admin is unaffected unless they've already burned 5 wrong codes.
 */
export const adminTotpLockout = createRatelimit({ limit: 5, windowMs: 15 * 60_000 });

/**
 * Operator login per-IP throttle: 10 attempts/min/IP — tighter than the generic
 * 60/min edge limit. Keyed `op-login:<ip>`.
 */
export const opLoginRatelimit = createRatelimit({ limit: 10, windowMs: 60_000 });

/**
 * Operator login consecutive-failure lockout: 5 bad attempts per 15 min per
 * username → 429 (mirrors adminTotpLockout). Keyed `op-login-fail:<username>`,
 * consumed (`.limit`) ONLY on INVALID_CREDENTIALS. The operator username
 * (BRAND_ACRONYM-last4phone) is publicly enumerable, so this account-level brake
 * is the primary defense against distributed credential-stuffing — the generic
 * 60/min/IP limit is meaningless across a botnet. A correct password is accepted
 * before the lockout counter is consumed, so a legitimate operator is unaffected
 * unless they have already burned 5 wrong attempts.
 */
export const opLoginLockout = createRatelimit({ limit: 5, windowMs: 15 * 60_000 });

/**
 * Admin login per-IP throttle: 10 attempts/min/IP — mirrors opLoginRatelimit.
 * Keyed `admin-login:<ip>`.
 */
export const adminLoginRatelimit = createRatelimit({ limit: 10, windowMs: 60_000 });

/**
 * Admin login consecutive-failure lockout: 5 bad attempts per 15 min per email.
 * Keyed `admin-login-fail:<email>`, consumed ONLY on INVALID_CREDENTIALS.
 * Mirrors opLoginLockout — account-level brake against credential-stuffing.
 */
export const adminLoginLockout = createRatelimit({ limit: 5, windowMs: 15 * 60_000 });
