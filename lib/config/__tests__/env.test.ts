/**
 * Unit tests for getEnv()'s boot-time email-stub warning (#337).
 *
 * Email delivery is gated on EMAIL_PROVIDER alone (decoupled from NOTIFY_STUB —
 * see the EMAIL_PROVIDER schema + email.ts). So a real env (NOTIFY_STUB=false →
 * real eSMS) with EMAIL_PROVIDER unset SILENTLY stubs email. getEnv() emits a
 * one-time console.warn for exactly that combination.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEnv, _resetEnvCache, readPlannerGeminiDailyMax } from '../env';

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
  // #643: strictness now keys off VERCEL_ENV (falling back to NODE_ENV when unset).
  // Clear any ambient VERCEL_ENV so tests that drive strictness via NODE_ENV are deterministic.
  delete process.env.VERCEL_ENV;
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

// Full production-required secret set so the prod superRefine reaches the STORAGE_STUB check.
const PROD_SECRETS = {
  JWT_SECRET: 'x'.repeat(48),
  JWT_OPERATOR_SECRET: 'x'.repeat(48),
  JWT_ADMIN_SECRET: 'x'.repeat(48),
  TOTP_ENCRYPTION_KEY: 'a'.repeat(64),
  BANK_ENCRYPTION_KEY: 'a'.repeat(64),
  DATABASE_URL: 'postgresql://u:p@host:5432/db',
  CRON_SECRET: 'cron-secret-xxxxxxxx',
  REFRESH_TOKEN_SECRET_CUSTOMER: 'r'.repeat(40),
  REFRESH_TOKEN_SECRET_OPERATOR: 'r'.repeat(40),
  REFRESH_TOKEN_SECRET_ADMIN: 'r'.repeat(40),
  TICKET_SECRET: 'ticket-secret-xxxxxxxx',
};

describe('getEnv — production STORAGE_STUB fail-fast (SEC-DEV-STUB-PROD-SAFETY #559)', () => {
  it('THROWS in production when STORAGE_STUB is true (real storage required)', () => {
    Object.assign(process.env, BASE, PROD_SECRETS, {
      NODE_ENV: 'production',
      PAYMENTS_STUB: 'true',
      STORAGE_STUB: 'true',
    });
    expect(() => getEnv()).toThrow(/STORAGE_STUB must be false in production/);
  });

  it('does NOT throw for STORAGE_STUB in production when it is false', () => {
    Object.assign(process.env, BASE, PROD_SECRETS, {
      NODE_ENV: 'production',
      PAYMENTS_STUB: 'true',
      STORAGE_STUB: 'false',
      STORAGE_BUCKET: 'b',
      STORAGE_REGION: 'r',
      STORAGE_ENDPOINT: 'https://r2',
      STORAGE_ACCESS_KEY: 'ak',
      STORAGE_SECRET_KEY: 'sk',
    });
    expect(() => getEnv()).not.toThrow();
  });
});

describe('getEnv — VERCEL_ENV preview tier is non-strict (#643)', () => {
  it('does NOT throw on a preview deploy missing prod secrets + STORAGE_STUB=true', () => {
    // Vercel sets NODE_ENV=production for preview builds too; VERCEL_ENV is the real discriminator.
    Object.assign(process.env, BASE, {
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
      PAYMENTS_STUB: 'true',
      STORAGE_STUB: 'true',
    });
    // Deliberately NO PROD_SECRETS set.
    expect(() => getEnv()).not.toThrow();
  });

  it('STILL throws on a real production deploy (VERCEL_ENV=production) missing secrets', () => {
    Object.assign(process.env, BASE, {
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      PAYMENTS_STUB: 'true',
      STORAGE_STUB: 'true',
    });
    // Missing PROD_SECRETS + STORAGE_STUB=true → the strict block fires.
    expect(() => getEnv()).toThrow(/required in production|STORAGE_STUB must be false/);
  });

  it('falls back to NODE_ENV when VERCEL_ENV is unset (self-host parity)', () => {
    Object.assign(process.env, BASE, {
      NODE_ENV: 'production',
      PAYMENTS_STUB: 'true',
      STORAGE_STUB: 'true',
    });
    delete process.env.VERCEL_ENV;
    expect(() => getEnv()).toThrow(/required in production|STORAGE_STUB must be false/);
  });
});

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
    // SEC-DEV-STUB-PROD-SAFETY (#559): storage must be real in prod, so these prod-env
    // fixtures set STORAGE_STUB=false + the S3 creds its superRefine then requires.
    STORAGE_STUB: 'false',
    STORAGE_BUCKET: 'b',
    STORAGE_REGION: 'r',
    STORAGE_ENDPOINT: 'https://r2',
    STORAGE_ACCESS_KEY: 'ak',
    STORAGE_SECRET_KEY: 'sk',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/d',
    JWT_SECRET: 'j'.repeat(32),
    JWT_OPERATOR_SECRET: 'o'.repeat(32),
    JWT_ADMIN_SECRET: 'a'.repeat(32),
    TOTP_ENCRYPTION_KEY: 'b'.repeat(64),
    BANK_ENCRYPTION_KEY: 'c'.repeat(64),
    CRON_SECRET: 'cron-secret-value',
    REFRESH_TOKEN_SECRET_CUSTOMER: 'r'.repeat(32),
    REFRESH_TOKEN_SECRET_OPERATOR: 's'.repeat(32),
    REFRESH_TOKEN_SECRET_ADMIN: 'u'.repeat(32),
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

/**
 * VNPAY_HASH_SECRET must not resolve to a value nobody set.
 *
 * It used to default to a literal committed in this public repo, and the guard that
 * rejected that default lived inside `if (env.VNPAY_ENABLED)` — so leaving VNPay
 * disabled (the permanent Phase-1 state) was exactly the configuration in which the
 * published secret went unchallenged. Any reader could then sign a valid vnp_* IPN.
 * The default is gone; these tests pin that it stays gone.
 */
describe('getEnv — VNPAY_HASH_SECRET has no published default', () => {
  const REAL_PAYMENTS = {
    ...BASE,
    PAYMENTS_STUB: 'false',
    NOTIFY_STUB: 'true',
    SEPAY_API_KEY: 'k'.repeat(32),
    VIETQR_ACCOUNT_NUMBER: '030976167267',
    DIRECT_URL: 'postgresql://u:p@localhost:5432/d',
  };

  it('leaves VNPAY_HASH_SECRET undefined when unset — never a repo literal', () => {
    Object.assign(process.env, REAL_PAYMENTS);
    delete process.env.VNPAY_HASH_SECRET;
    delete process.env.VNPAY_ENABLED;

    expect(getEnv().VNPAY_HASH_SECRET).toBeUndefined();
  });

  it('still requires a real secret when VNPAY_ENABLED=true', () => {
    Object.assign(process.env, REAL_PAYMENTS, { VNPAY_ENABLED: 'true' });
    delete process.env.VNPAY_HASH_SECRET;

    expect(() => getEnv()).toThrow(/VNPAY_HASH_SECRET/);
  });

  it('boots in bank-transfer-only prod config without any VNPAY_* vars set', () => {
    // The live Vercel shape: SePay + cash, no PSP credentials of any kind.
    Object.assign(process.env, REAL_PAYMENTS);
    for (const k of ['VNPAY_HASH_SECRET', 'VNPAY_ENABLED', 'VNPAY_TMN_CODE', 'VNPAY_RETURN_URL']) {
      delete process.env[k];
    }

    expect(() => getEnv()).not.toThrow();
  });
});

describe('getEnv — Google OAuth guard (ADR-021 / P5)', () => {
  it('throws when GOOGLE_OAUTH_ENABLED=true and creds/base-url are missing', () => {
    Object.assign(process.env, BASE, { GOOGLE_OAUTH_ENABLED: 'true' });
    for (const k of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NEXT_PUBLIC_BASE_URL']) {
      delete process.env[k];
    }
    expect(() => getEnv()).toThrow(
      /GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|NEXT_PUBLIC_BASE_URL/
    );
  });

  it('parses when GOOGLE_OAUTH_ENABLED=true and all four are set', () => {
    Object.assign(process.env, BASE, {
      GOOGLE_OAUTH_ENABLED: 'true',
      NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED: 'true', // #478: client/server flag parity
      GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'secret',
      NEXT_PUBLIC_BASE_URL: 'https://lenxevn.com',
      GOAUTH_COOKIE_SECRET: 'g'.repeat(32),
    });
    expect(() => getEnv()).not.toThrow();
  });

  it('throws when GOOGLE_OAUTH_ENABLED=true but GOAUTH_COOKIE_SECRET is missing', () => {
    Object.assign(process.env, BASE, {
      GOOGLE_OAUTH_ENABLED: 'true',
      GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'secret',
      NEXT_PUBLIC_BASE_URL: 'https://lenxevn.com',
    });
    delete process.env.GOAUTH_COOKIE_SECRET;
    expect(() => getEnv()).toThrow(/GOAUTH_COOKIE_SECRET/);
  });

  it('parses when Google OAuth is disabled (default) — no regression', () => {
    Object.assign(process.env, BASE);
    for (const k of ['GOOGLE_OAUTH_ENABLED', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) {
      delete process.env[k];
    }
    expect(() => getEnv()).not.toThrow();
  });

  it('rejects a non-URL NEXT_PUBLIC_BASE_URL', () => {
    Object.assign(process.env, BASE, { NEXT_PUBLIC_BASE_URL: 'not-a-url' });
    expect(() => getEnv()).toThrow(/NEXT_PUBLIC_BASE_URL/);
  });
});

describe('getEnv — Google OAuth client/server flag parity (#478)', () => {
  it('THROWS when NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true but the server flag is off (dead-end)', () => {
    Object.assign(process.env, BASE, { NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED: 'true' });
    delete process.env.GOOGLE_OAUTH_ENABLED;
    _resetEnvCache();
    expect(() => getEnv()).toThrow(/NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED/);
  });

  it('does NOT throw when both flags are off (default parity)', () => {
    Object.assign(process.env, BASE);
    delete process.env.GOOGLE_OAUTH_ENABLED;
    delete process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED;
    _resetEnvCache();
    expect(() => getEnv()).not.toThrow();
  });
});

describe('readPlannerGeminiDailyMax (#551)', () => {
  // Standalone reader (module-safe) for lib/ratelimit — validates the same rule as the envSchema
  // field, so a typo/non-numeric fails LOUDLY instead of the old `Number()||1000` silently → 1000.
  it('defaults to 1000 when unset', () => {
    delete process.env.PLANNER_GEMINI_DAILY_MAX;
    expect(readPlannerGeminiDailyMax()).toBe(1000);
  });

  it('coerces a valid numeric string', () => {
    process.env.PLANNER_GEMINI_DAILY_MAX = '2500';
    expect(readPlannerGeminiDailyMax()).toBe(2500);
  });

  it('THROWS on 0 (the old ||1000 footgun) instead of silently becoming 1000', () => {
    process.env.PLANNER_GEMINI_DAILY_MAX = '0';
    expect(() => readPlannerGeminiDailyMax()).toThrow();
  });

  it('THROWS on a non-numeric value', () => {
    process.env.PLANNER_GEMINI_DAILY_MAX = 'lots';
    expect(() => readPlannerGeminiDailyMax()).toThrow();
  });

  it('THROWS on a negative value', () => {
    process.env.PLANNER_GEMINI_DAILY_MAX = '-5';
    expect(() => readPlannerGeminiDailyMax()).toThrow();
  });
});
