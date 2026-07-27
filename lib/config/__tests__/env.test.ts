/**
 * Unit tests for getEnv()'s boot-time email-stub warning (#337).
 *
 * Email delivery is gated on EMAIL_PROVIDER alone (decoupled from NOTIFY_STUB —
 * see the EMAIL_PROVIDER schema + email.ts). So a real env (NOTIFY_STUB=false →
 * real eSMS) with EMAIL_PROVIDER unset SILENTLY stubs email. getEnv() emits a
 * one-time console.warn for exactly that combination.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEnv, _resetEnvCache } from '../env';

// Self-sufficient base so parsing does not depend on the ambient env: force the
// other subsystems to stub mode (so their superRefine credential checks pass)
// and supply the always-required HOLD_SECRET + eSMS creds (eSMS required because
// NOTIFY_STUB=false below). Production-required JWT secrets are gated on
// NODE_ENV=production, so they are not needed in the test runtime.
const BASE = {
  HOLD_SECRET: 'a'.repeat(64), // must be a hex string
  PAYMENTS_STUB: 'true',
  STORAGE_STUB: 'true',
  ESMS_API_KEY: 'k',
  ESMS_SECRET_KEY: 's',
  ESMS_BRANDNAME: 'BBVN',
};

let savedEnv: NodeJS.ProcessEnv;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  savedEnv = { ...process.env };
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  _resetEnvCache();
});

afterEach(() => {
  process.env = savedEnv;
  warnSpy.mockRestore();
  _resetEnvCache();
});

function warned(): boolean {
  return warnSpy.mock.calls.some((c: unknown[]) => String(c[0]).includes('env.email.silently_stubbed'));
}

describe('getEnv — email-stub boot warn (#337)', () => {
  it('warns when NOTIFY_STUB=false and EMAIL_PROVIDER is unset (silently stubbed)', () => {
    Object.assign(process.env, BASE, { NOTIFY_STUB: 'false' });
    delete process.env.EMAIL_PROVIDER;

    getEnv();

    expect(warned()).toBe(true);
  });

  it('does NOT warn when EMAIL_PROVIDER=resend (real email wired)', () => {
    Object.assign(process.env, BASE, {
      NOTIFY_STUB: 'false',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test',
    });

    getEnv();

    expect(warned()).toBe(false);
  });

  // Regression guard for the review finding on this PR: the warn was originally
  // ANDed with `!NOTIFY_STUB`, and this case asserted SILENCE for it. But
  // NOTIFY_STUB defaults to 'true' and prod sets "true", so that combination is
  // the ONLY one that exists — the gate was unreachable everywhere, and a green
  // test was ratifying it (CLAUDE.md 2026-07-23: "a test that asserts ambiguity
  // resolves somehow is not a safety test"). Email is decoupled from SMS (#326),
  // so a stubbed SMS channel says nothing about whether email is delivered.
  it('warns when NOTIFY_STUB=true and EMAIL_PROVIDER is unset (prod flag combo)', () => {
    Object.assign(process.env, BASE, { NOTIFY_STUB: 'true' });
    delete process.env.EMAIL_PROVIDER;

    getEnv();

    expect(warned()).toBe(true);
  });

  it('warns when EMAIL_PROVIDER is explicitly "stub" (the shape .env files use)', () => {
    Object.assign(process.env, BASE, { NOTIFY_STUB: 'true', EMAIL_PROVIDER: 'stub' });

    getEnv();

    expect(warned()).toBe(true);
  });

  it('does NOT warn when EMAIL_PROVIDER=resend regardless of NOTIFY_STUB', () => {
    Object.assign(process.env, BASE, {
      NOTIFY_STUB: 'true',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test',
    });

    getEnv();

    expect(warned()).toBe(false);
  });

  it('warns only once — the parsed env is cached', () => {
    Object.assign(process.env, BASE, { NOTIFY_STUB: 'true' });
    delete process.env.EMAIL_PROVIDER;

    getEnv();
    getEnv();

    const calls = warnSpy.mock.calls.filter((c: unknown[]) =>
      String(c[0]).includes('env.email.silently_stubbed'),
    );
    expect(calls).toHaveLength(1);
  });
});

/**
 * Boot warn when production would silently rate-limit in memory.
 *
 * createRatelimit() falls back to InMemoryRatelimit — a per-instance Map — when no
 * Redis backend resolves. On Vercel that means the limit is really "per lambda
 * instance": N warm instances give N× the configured budget and every cold start
 * resets the counter, with no error and nothing logged. Warn rather than throw, so a
 * lost env var degrades loudly instead of failing the deploy of a live site.
 */
describe('getEnv — in-memory rate limiting in production', () => {
  function ratelimitWarned(): boolean {
    return warnSpy.mock.calls.some((c: unknown[]) =>
      String(c[0]).includes('env.ratelimit.in_memory_in_production'),
    );
  }

  // NODE_ENV=production turns on the superRefine block requiring every secret, so
  // this base carries them — the warning under test is unrelated to any of them.
  const PROD = {
    ...BASE,
    NOTIFY_STUB: 'true',
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_x',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/d',
    JWT_SECRET: 'j'.repeat(32),
    JWT_OPERATOR_SECRET: 'o'.repeat(32),
    JWT_ADMIN_SECRET: 'a'.repeat(32),
    TOTP_ENCRYPTION_KEY: 'b'.repeat(64),
    BANK_ENCRYPTION_KEY: 'c'.repeat(64),
    CRON_SECRET: 'cron-secret-value',
    REFRESH_TOKEN_SECRET: 'r'.repeat(32),
    TICKET_SECRET: 't'.repeat(32),
  };

  function clearRedisEnv() {
    for (const k of ['REDIS_PROVIDER', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) {
      delete process.env[k];
    }
  }

  it('warns in production when no Redis backend resolves', () => {
    Object.assign(process.env, PROD, { NODE_ENV: 'production' });
    clearRedisEnv();

    getEnv();

    expect(ratelimitWarned()).toBe(true);
  });

  it('does NOT warn when REDIS_PROVIDER=upstash', () => {
    Object.assign(process.env, PROD, {
      NODE_ENV: 'production',
      REDIS_PROVIDER: 'upstash',
      UPSTASH_REDIS_REST_URL: 'https://fake.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'fake-token',
    });

    getEnv();

    expect(ratelimitWarned()).toBe(false);
  });

  it('does NOT warn when the Upstash vars are set but REDIS_PROVIDER says "memory"', () => {
    // The false-positive this warning must not produce. createRatelimit picks Upstash
    // whenever BOTH REST vars are present, regardless of REDIS_PROVIDER — so reading
    // the schema field alone would warn while the backend is genuinely fine. Both the
    // factory and this warning go through resolveRatelimitBackend for that reason.
    Object.assign(process.env, PROD, {
      NODE_ENV: 'production',
      REDIS_PROVIDER: 'memory',
      UPSTASH_REDIS_REST_URL: 'https://fake.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'fake-token',
    });

    getEnv();

    expect(ratelimitWarned()).toBe(false);
  });

  it('does NOT warn outside production (dev/CI run in memory by design)', () => {
    Object.assign(process.env, PROD, { NODE_ENV: 'test' });
    clearRedisEnv();

    getEnv();

    expect(ratelimitWarned()).toBe(false);
  });
});
