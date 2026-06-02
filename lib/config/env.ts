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

  /**
   * HMAC key the fake gateway uses to sign + verify its own stub IPNs.
   * Dev-only — never used by a real PSP. MUST be overridden (or unused) in
   * production where PAYMENTS_STUB is false.
   */
  STUB_PAYMENT_SECRET: z
    .string()
    .min(16, 'STUB_PAYMENT_SECRET must be at least 16 characters')
    .default('dev-stub-payment-secret-local-only-change-me'),
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
