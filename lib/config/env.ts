/**
 * Typed, validated environment variable access for Issue 002 (hold-buyer-info-countdown).
 *
 * Parsed once at module-load time so misconfigured deploys fail fast.
 * Call getEnv() from route handlers / server modules — never from client bundles.
 */

import { z } from 'zod';

const envSchema = z.object({
  /**
   * HMAC-SHA256 signing secret for bb_hold cookies.
   * Must be at least 32 bytes of hex (64 hex chars).
   */
  HOLD_SECRET: z
    .string()
    .min(64, 'HOLD_SECRET must be at least 64 hex characters (32 bytes)')
    .regex(/^[0-9a-fA-F]+$/, 'HOLD_SECRET must be a hex string'),

  /**
   * Controls how the sweeper cron behaves.
   * "count"  — log count of expired holds only (safe default during canary)
   * "update" — actually mark expired holds as status='expired'
   */
  HOLD_SWEEPER_MODE: z.enum(['count', 'update']).default('count'),

  // ---------------------------------------------------------------------------
  // MoMo payment gateway (Issue 004)
  // Defaults to MoMo sandbox credentials (vendor-published, public).
  // Override in production with real credentials.
  // ---------------------------------------------------------------------------

  /**
   * MoMo partner code — identifies the merchant.
   * Sandbox default: MOMOBKUN20180529
   */
  MOMO_PARTNER_CODE: z.string().default('MOMOBKUN20180529'),

  /**
   * MoMo access key — used in signature construction (canonical sort string).
   * Sandbox default: klm05TvNBzhg7h7j
   */
  MOMO_ACCESS_KEY: z.string().default('klm05TvNBzhg7h7j'),

  /**
   * MoMo secret key — HMAC-SHA256 key for request + IPN signature verification.
   * NEVER log this value.
   * Sandbox default: at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa
   */
  MOMO_SECRET_KEY: z.string().default('at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa'),

  /**
   * MoMo gateway create-order endpoint.
   * Sandbox default: https://test-payment.momo.vn/v2/gateway/api/create
   */
  MOMO_ENDPOINT: z
    .string()
    .url()
    .default('https://test-payment.momo.vn/v2/gateway/api/create'),

  /**
   * Payout settlement test-injection flag (Issue 019).
   * When "true", settlePayout() returns a failure result so the payout
   * processor's pending → processing → failed path can be exercised in tests.
   * Production default "false" — the stub always settles successfully.
   */
  PAYOUT_SETTLEMENT_FORCE_FAIL: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  // ---------------------------------------------------------------------------
  // Local fake-gateway stub (Phase 1 — run all online-payment stories with no
  // real PSP credentials). When PAYMENTS_STUB="true", getGatewayFor('momo')
  // returns the stub adapter too; zalopay/card ALWAYS use the stub until their
  // real adapters land in Phase 2. The stub signs its own IPN with
  // STUB_PAYMENT_SECRET (HMAC-SHA256) so the verifyWebhook path is exercised
  // for real locally.
  // ---------------------------------------------------------------------------

  /** Route all online payments through the local fake-gateway stub. */
  PAYMENTS_STUB: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  // ---------------------------------------------------------------------------
  // Local notification stub (Issue 058). When NOTIFY_STUB="true", the SMS/email
  // channel adapters record + log the dispatch instead of hitting a real
  // provider. Real eSMS/email HTTP integration is deferred (project memory:
  // payment-deferral-strategy) — until then the channel adapters always behave
  // as stubs, and this flag exists so the dispatcher's wiring matches the
  // PAYMENTS_STUB shape and the cutover to real providers is a one-line flip.
  // ---------------------------------------------------------------------------

  /** Route all notification channels (sms/email) through the local no-network stub. */
  NOTIFY_STUB: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  /**
   * HMAC key the fake gateway uses to sign + verify its own stub IPNs.
   * Dev-only — never used by a real PSP. MUST be overridden (or unused) in
   * production where PAYMENTS_STUB is false.
   */
  STUB_PAYMENT_SECRET: z
    .string()
    .min(16, 'STUB_PAYMENT_SECRET must be at least 16 characters')
    .default('dev-stub-payment-secret-local-only-change-me'),

  // ---------------------------------------------------------------------------
  // Object storage (Issue 059 — signed PUT/GET, keys in DB).
  // The contract (server mints signed URLs, never proxies bytes; DB stores the
  // object KEY, never the blob) runs fully in STUB mode locally + in tests.
  // Real S3/@aws-sdk is a Wave-9 concern and is deferred behind STORAGE_STUB
  // exactly like PAYMENTS_STUB defers the real PSP. The STORAGE_* connection
  // vars are OPTIONAL — they're only consulted on the (not-yet-implemented)
  // real branch when STORAGE_STUB=false; stub mode needs none of them.
  // ---------------------------------------------------------------------------

  /** Route all object storage through the local stub URL-signer. Default on. */
  STORAGE_STUB: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),

  /** S3 bucket name (real branch only). */
  STORAGE_BUCKET: z.string().optional(),
  /** S3 region (real branch only). */
  STORAGE_REGION: z.string().optional(),
  /** S3-compatible endpoint URL (real branch only; e.g. for R2/MinIO). */
  STORAGE_ENDPOINT: z.string().optional(),
  /** S3 access key id (real branch only). */
  STORAGE_ACCESS_KEY: z.string().optional(),
  /** S3 secret access key (real branch only). NEVER log this value. */
  STORAGE_SECRET_KEY: z.string().optional(),

  /**
   * HMAC-SHA256 key the storage stub uses to sign + verify its own stub
   * PUT/GET URLs so they're tamper-evident (mirrors STUB_PAYMENT_SECRET).
   * Dev-only — never used by real S3. MUST be overridden (or unused) in
   * production where STORAGE_STUB is false.
   */
  STORAGE_STUB_SECRET: z
    .string()
    .min(16, 'STORAGE_STUB_SECRET must be at least 16 characters')
    .default('dev-stub-storage-secret-local-only-change-me'),

  // ---------------------------------------------------------------------------
  // Observability — Sentry (Issue 061).
  // The error-reporting SEAM (lib/observability/sentry.ts) ships now; the real
  // @sentry/nextjs SDK is DEFERRED (not installed — offline/dep-conscious), the
  // same "defer real, ship the seam" pattern as the refund PSP / S3 storage stubs.
  //
  // UNSET (default) → captureException/captureMessage route every event to the
  // structured pino logger (PII-scrubbed). This is the dev/test behaviour and
  // stays the behaviour until Stage-1 wires the real SDK in instrumentation.ts.
  // SET → the seam will (once Stage-1 lands) forward to the real Sentry client;
  // the PII-scrubbing beforeSend equivalent already runs in the seam regardless.
  // ---------------------------------------------------------------------------

  /** Sentry DSN. Unset → events go to the structured logger fallback sink. */
  SENTRY_DSN: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let _env: AppEnv | null = null;

/**
 * Returns the parsed, validated env config.
 * Throws on first call if required vars are missing/invalid — fails fast at startup.
 */
export function getEnv(): AppEnv {
  if (_env) return _env;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment configuration error:\n${messages}`);
  }
  _env = result.data;
  return _env;
}

/** Reset cached env (test helper only). */
export function _resetEnvCache(): void {
  _env = null;
}
