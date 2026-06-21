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

  // ---------------------------------------------------------------------------
  // VNPay payment gateway (SCALE Issue 077)
  // Defaults to VNPay sandbox credentials. Override for production.
  // ---------------------------------------------------------------------------

  VNPAY_TMN_CODE: z.string().default('VNPAYTEST'),
  VNPAY_HASH_SECRET: z
    .string()
    .min(32, 'VNPAY_HASH_SECRET must be at least 32 characters')
    .default('VNPAYSECRETTEST0123456789ABCDEF01'),
  VNPAY_URL: z.string().url().default('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
  /**
   * Absolute URL VNPay calls for IPN notifications (vnp_IpnUrl).
   * Must be publicly reachable by VNPay servers. Optional — if unset,
   * createPayment falls back to the caller-provided ipnUrl which is built from
   * the request's own host (the preferred path in initiateOnlineBooking).
   */
  VNPAY_IPN_URL: z.string().url().optional(),
  /**
   * Absolute URL VNPay redirects the browser to after payment (vnp_ReturnUrl).
   * Must be an absolute URL — VNPay rejects relative paths.
   * Required when PAYMENTS_STUB=false (enforced in superRefine below).
   * No default: must be set explicitly so sandbox vs production never share a URL.
   */
  VNPAY_RETURN_URL: z
    .string()
    .url('VNPAY_RETURN_URL must be an absolute URL (e.g. https://example.com/api/payments/vnpay/return)')
    .optional(),

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
  // Notification stub vs real eSMS (Issue 058 + SMS-OTP cutover). When
  // NOTIFY_STUB="true" (the DEFAULT — mirrors STORAGE_STUB) the SMS/email
  // channel adapters record + log the dispatch with no network I/O. Flip to
  // "false" to route SMS through the real eSMS.vn HTTP adapter; the superRefine
  // below then REQUIRES the ESMS_* creds so a real-mode deploy fails fast at
  // boot rather than at first OTP send. Email has no real provider yet, so a
  // real-mode deploy still stubs email (see lib/notification/email.ts).
  // ---------------------------------------------------------------------------

  /** Route all notification channels (sms/email) through the local no-network stub. Default on. */
  NOTIFY_STUB: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),

  // ---------------------------------------------------------------------------
  // eSMS.vn SMS provider (real OTP/notification delivery for Vietnam).
  // OPTIONAL until NOTIFY_STUB=false — then the superRefine at the bottom of the
  // schema requires the three creds. SmsType "2" = CSKH/OTP brandname channel;
  // ESMS_SANDBOX="true" sends through eSMS test mode (no charge, no real SMS).
  // ---------------------------------------------------------------------------

  /** eSMS API key (real branch only). */
  ESMS_API_KEY: z.string().optional(),
  /** eSMS secret key (real branch only). NEVER log this value. */
  ESMS_SECRET_KEY: z.string().optional(),
  /** Registered eSMS Brandname (sender ID) — required for OTP/CSKH (real branch only). */
  ESMS_BRANDNAME: z.string().optional(),
  /** eSMS SmsType for OTP messages ("2" = CSKH/OTP brandname). */
  ESMS_OTP_SMSTYPE: z.string().default('2'),
  /** eSMS sandbox flag — true = test send (no charge / no real SMS). Default on. */
  ESMS_SANDBOX: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  /** eSMS REST base URL (override in tests to point at a mock server). */
  ESMS_BASE_URL: z.string().url().default('https://rest.esms.vn'),

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

  // ---------------------------------------------------------------------------
  // Ticket QR signing (Issue 071).
  // DEDICATED ticketing key — separate from JWT_SECRET so that compromise of one
  // realm's signing key does NOT forge the other. This key signs the
  // tamper-evident ticket lookup token embedded in the boarding QR code
  // (lib/ticketing/ticketToken.ts). The token carries ONLY lookup keys
  // (bookingRef + confirmationToken), no PII — the verify page does a fresh DB
  // read for trip/status, so the token is a tamper-evident pointer, not a bearer
  // credential.
  //
  // Test fallback: ticketToken.ts's getTicketSecret() falls back to
  // 't'.repeat(32) when NODE_ENV === 'test' (mirrors the JWT_SECRET getter in
  // lib/auth/jwt.ts), so unit tests run without this var set. In production this
  // var IS required — min 16 chars.
  // ---------------------------------------------------------------------------

  /** HS256 signing secret for ticket QR lookup tokens (Issue 071). */
  TICKET_SECRET: z
    .string()
    .min(16, 'TICKET_SECRET must be at least 16 characters')
    .optional(),

  /**
   * HS256 signing secret for customer session JWTs.
   * Must be at least 32 characters. Required in production.
   */
  JWT_SECRET: z.string().min(32).optional(),

  /** HS256 signing secret for operator session JWTs (AUTH-02 realm split). */
  JWT_OPERATOR_SECRET: z.string().min(32).optional(),

  /** HS256 signing secret for admin session JWTs (AUTH-02 realm split). */
  JWT_ADMIN_SECRET: z.string().min(32).optional(),

  /** AES-256-GCM key for AdminUser.totpSecret at-rest encryption (AUTH-03). 64 hex chars = 32 bytes. */
  TOTP_ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-f]+$/i).optional(),

  /**
   * PostgreSQL connection string.
   * Required in production; tests use a dedicated test database or mocks.
   */
  DATABASE_URL: z.string().optional(),

  /**
   * Direct PostgreSQL connection URL — bypasses PgBouncer for Prisma migrations
   * (prepared statements, CREATE INDEX CONCURRENTLY). Required in production
   * when PAYMENTS_STUB=false; for local dev set to the same value as DATABASE_URL.
   */
  DIRECT_URL: z.string().url().optional(),

  /** Max connections per pg.Pool instance (default 1 — PgBouncer handles pooling). */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(1),

  /**
   * Bearer token that Vercel Cron injects as `Authorization: Bearer <secret>`.
   * Must be at least 16 characters. Required in production (cron routes fail-closed).
   */
  CRON_SECRET: z.string().min(16).optional(),

  /** Ops team email for internal notifications (charter declines, escalations). */
  OPS_EMAIL: z.string().email().optional(),

  // ---------------------------------------------------------------------------
  // E-invoice (Issue 074 — Circular 78/2021 hóa đơn điện tử via MISA meInvoice).
  // EINVOICE_ENABLED="stub" (default) → stub provider, no network I/O.
  // EINVOICE_ENABLED="misa" → real MISA API; MISA_* creds required.
  // ---------------------------------------------------------------------------

  /** E-invoice mode: "stub" (log only) or "misa" (real API). */
  EINVOICE_ENABLED: z.enum(['stub', 'misa']).default('stub'),
  /** MISA meInvoice API base URL (real branch only). */
  MISA_API_URL: z.string().url().optional(),
  /** MISA API key. NEVER log this value. */
  MISA_API_KEY: z.string().optional(),
  /** MISA company code. */
  MISA_COMPANY_CODE: z.string().optional(),
  /** MISA invoice template code. */
  MISA_TEMPLATE_CODE: z.string().optional(),

  // ---------------------------------------------------------------------------
  // Transactional email provider (Issue 080 — Resend).
  // EMAIL_PROVIDER="stub" (default) → NOTIFY_STUB covers; no real send.
  // EMAIL_PROVIDER="resend" → Resend API; RESEND_API_KEY required.
  // ---------------------------------------------------------------------------

  /** Email dispatch provider: "stub" or "resend". */
  EMAIL_PROVIDER: z.enum(['stub', 'resend']).default('stub'),
  /** Resend API key (real branch only). NEVER log this value. */
  RESEND_API_KEY: z.string().optional(),
  /** Sender address for transactional email. */
  EMAIL_FROM: z.string().default('noreply@busbookvn.com'),

  // ---------------------------------------------------------------------------
  // Self-hosted Redis (Issue 083 — ioredis).
  // REDIS_PROVIDER unset/memory → InMemoryRatelimit + in-memory JTI store.
  // REDIS_PROVIDER="ioredis"   → IoRedisRatelimit + ioredis JTI consume.
  // REDIS_PROVIDER="upstash"   → UpstashRatelimit + Upstash JTI consume.
  // ---------------------------------------------------------------------------

  /** Redis backend selection. */
  REDIS_PROVIDER: z.enum(['memory', 'ioredis', 'upstash']).default('memory'),
  /** Redis connection URL for ioredis provider. */
  REDIS_URL: z.string().default('redis://localhost:6379'),
  /** Upstash Redis REST URL (required when REDIS_PROVIDER=upstash). */
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  /** Upstash Redis REST token (required when REDIS_PROVIDER=upstash). NEVER log this value. */
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  /**
   * HMAC-SHA256 secret for refresh-token signing (customer + operator + admin realms).
   * Must be at least 32 characters. Required in production; test fallback to 'b'.repeat(32).
   */
  REFRESH_TOKEN_SECRET: z.string().min(32).optional(),

  /** Shadow database URL for Prisma migrations (prisma.config.ts). */
  SHADOW_DATABASE_URL: z.string().url().optional(),

  /** Enable OTP peek endpoint for dev/test (ignored in production). */
  OTP_PEEK_ENABLED: z.string().optional(),
}).superRefine((env, ctx) => {
  // Real eSMS mode (NOTIFY_STUB=false) must carry credentials — fail fast at boot.
  if (!env.NOTIFY_STUB) {
    for (const key of ['ESMS_API_KEY', 'ESMS_SECRET_KEY', 'ESMS_BRANDNAME'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when NOTIFY_STUB=false (real eSMS mode)`,
        });
      }
    }
  }
  // Real VNPay mode (PAYMENTS_STUB=false): VNPay credentials must not be defaults.
  // Top-level (not NODE_ENV-gated) so staging/preview with real PSP also validates.
  if (!env.PAYMENTS_STUB) {
    const VNPAY_DEFAULT_SECRET = 'VNPAYSECRETTEST0123456789ABCDEF01';
    const VNPAY_DEFAULT_TMN = 'VNPAYTEST';
    if (!env.VNPAY_HASH_SECRET || env.VNPAY_HASH_SECRET === VNPAY_DEFAULT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['VNPAY_HASH_SECRET'],
        message:
          'VNPAY_HASH_SECRET must be set to a real secret when PAYMENTS_STUB=false',
      });
    }
    if (!env.VNPAY_TMN_CODE || env.VNPAY_TMN_CODE === VNPAY_DEFAULT_TMN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['VNPAY_TMN_CODE'],
        message:
          'VNPAY_TMN_CODE must be set to a real merchant code when PAYMENTS_STUB=false',
      });
    }
    if (!env.VNPAY_RETURN_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['VNPAY_RETURN_URL'],
        message:
          'VNPAY_RETURN_URL must be set to an absolute URL when PAYMENTS_STUB=false',
      });
    }
  }
  // Real MISA e-invoice mode must carry credentials.
  if (env.EINVOICE_ENABLED === 'misa') {
    for (const key of ['MISA_API_URL', 'MISA_API_KEY', 'MISA_COMPANY_CODE', 'MISA_TEMPLATE_CODE'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when EINVOICE_ENABLED=misa`,
        });
      }
    }
    // MISA API URL must use HTTPS in all modes (API key in header — plaintext over HTTP is a credential leak).
    if (env.MISA_API_URL && !env.MISA_API_URL.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MISA_API_URL'],
        message: 'MISA_API_URL must use HTTPS',
      });
    }
  }
  // Real Resend email mode must carry API key.
  if (env.EMAIL_PROVIDER === 'resend') {
    if (!env.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY is required when EMAIL_PROVIDER=resend',
      });
    }
  }
  // Upstash provider must carry REST credentials.
  if (env.REDIS_PROVIDER === 'upstash') {
    if (!env.UPSTASH_REDIS_REST_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['UPSTASH_REDIS_REST_URL'],
        message: 'UPSTASH_REDIS_REST_URL is required when REDIS_PROVIDER=upstash',
      });
    }
    if (!env.UPSTASH_REDIS_REST_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['UPSTASH_REDIS_REST_TOKEN'],
        message: 'UPSTASH_REDIS_REST_TOKEN is required when REDIS_PROVIDER=upstash',
      });
    }
  }
  if (process.env.NODE_ENV === 'production') {
    for (const key of ['JWT_SECRET', 'JWT_OPERATOR_SECRET', 'JWT_ADMIN_SECRET', 'TOTP_ENCRYPTION_KEY', 'DATABASE_URL', 'CRON_SECRET', 'REFRESH_TOKEN_SECRET'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required in production`,
        });
      }
    }
    // DIRECT_URL is required in production when using real payments (non-stub).
    // It must point directly at Postgres (bypassing PgBouncer) for migrations.
    if (!env.PAYMENTS_STUB && !env.DIRECT_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DIRECT_URL'],
        message: 'DIRECT_URL is required in production when PAYMENTS_STUB=false',
      });
    }
    // ioredis provider in production must have a real REDIS_URL (not the localhost default).
    if (env.REDIS_PROVIDER === 'ioredis') {
      if (!env.REDIS_URL || env.REDIS_URL === 'redis://localhost:6379') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['REDIS_URL'],
          message: 'REDIS_URL must be set to a non-localhost value when REDIS_PROVIDER=ioredis in production',
        });
      }
    }
  }
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
