/**
 * TEMPORARY (dev/test): admin TOTP bypass switch.
 *
 * When ADMIN_TOTP_DISABLED=true AND not running in production, the admin login +
 * refresh routes mint sessions with totpVerified=true so the 6-digit code step is
 * skipped during testing. HARD-GUARDED: returns false in production no matter what
 * the env var says — TOTP is the admin realm's core control and must never be
 * disablable on a prod deploy.
 *
 * Re-enable normal TOTP: set ADMIN_TOTP_DISABLED=false (or remove it) + restart.
 * Cleanup later: delete this file and its 2 call sites (admin login + refresh routes).
 */
export function isAdminTotpDisabled(): boolean {
  return process.env.ADMIN_TOTP_DISABLED === 'true' && process.env.NODE_ENV !== 'production';
}
