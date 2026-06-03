/**
 * Ratelimit factory — exports Ratelimit interface, InMemoryRatelimit (dev/CI default),
 * and UpstashRatelimit (production, sliding window via @upstash/ratelimit).
 */

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rl: any = null;

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

  async limit(identifier: string): Promise<RatelimitResult> {
    const client = await this.getClient();
    const result = await client.limit(identifier);
    const now = Date.now();
    const retryAfterSecs = result.success ? 0 : Math.max(0, Math.ceil((result.reset - now) / 1000));
    return {
      allowed: result.success,
      remaining: result.remaining,
      retryAfter: retryAfterSecs,
    };
  }
}

/**
 * Factory that returns the appropriate Ratelimit implementation
 * based on the runtime environment.
 *
 * - CI / development (no UPSTASH_REDIS_REST_URL): InMemoryRatelimit
 * - Production (UPSTASH_REDIS_REST_URL set): UpstashRatelimit
 */
export function createRatelimit(options: InMemoryRatelimitOptions): Ratelimit {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new UpstashRatelimit(options);
  }
  return new InMemoryRatelimit(options);
}

/** Default shared ratelimit: 60 requests/min/IP */
export const ratelimit = createRatelimit({ limit: 60, windowMs: 60_000 });

/** Operator forgot-password OTP send: 3 per 15 min per phone (Issue 010) */
export const opForgotPasswordRatelimit = createRatelimit({ limit: 3, windowMs: 15 * 60_000 });

/** Self-serve operator registration: 5 per hour per IP (Issue 076) — abuse guard
 *  on the public, unauthenticated /api/op/register POST. Keyed `op-register:<ip>`. */
export const opRegisterRatelimit = createRatelimit({ limit: 5, windowMs: 60 * 60_000 });

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
