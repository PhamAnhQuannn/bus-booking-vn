/**
 * Ratelimit factory — exports Ratelimit interface, InMemoryRatelimit (dev/CI default),
 * and UpstashRatelimit stub (production, body deferred to Issue 002).
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
 * The full body (sliding window algorithm) is deferred to Issue 002.
 * In this issue it stubs the interface so the route handler can import
 * a Ratelimit without runtime errors in production builds.
 */
export class UpstashRatelimit implements Ratelimit {
  constructor(_options: { limit?: number; windowMs?: number }) {
    // Upstash client initialized lazily on first call (Issue 002)
  }

  async limit(_identifier: string): Promise<RatelimitResult> {
    // Deferred to Issue 002 — in production, this should never be called
    // without UPSTASH_REDIS_REST_URL being set.
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      throw new Error('UPSTASH_REDIS_REST_URL is required for UpstashRatelimit');
    }
    // Stub: allow all requests until Issue 002 wires real Upstash client
    return { allowed: true, remaining: 59, retryAfter: 0 };
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
  if (process.env.UPSTASH_REDIS_REST_URL) {
    return new UpstashRatelimit(options);
  }
  return new InMemoryRatelimit(options);
}

/** Default shared ratelimit: 60 requests/min/IP */
export const ratelimit = createRatelimit({ limit: 60, windowMs: 60_000 });

