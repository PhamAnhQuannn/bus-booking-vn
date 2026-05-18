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

  /**
   * When "true", searchTrips() subtracts blockedSeats + active-hold sum from capacity.
   * Flip after Steps 7+9 ship.
   */
  SEARCH_USE_BLOCKED_SEATS: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
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
