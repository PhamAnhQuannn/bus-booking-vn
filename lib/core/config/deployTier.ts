/**
 * Deployment-tier detection (#643).
 *
 * `getEnv()` and several low-level secret getters used to gate their
 * production-only strictness on `process.env.NODE_ENV === 'production'`. On Vercel
 * that predicate is TRUE for BOTH preview and production deployments (Vercel sets
 * NODE_ENV=production for every deployed build), so preview deployments were held to
 * the full production config contract — missing Production-scoped secrets +
 * STORAGE_STUB=true made getEnv() throw at boot, 500-ing every route that touches it.
 *
 * The variable that actually distinguishes the tiers is VERCEL_ENV
 * ('production' | 'preview' | 'development'). This helper reads it and treats ONLY a
 * real Vercel production deployment as strict. Off Vercel (self-host / CI / local
 * `next build`) VERCEL_ENV is unset, so it falls back to the historical
 * NODE_ENV==='production' check — the change is additive for Vercel and a no-op
 * everywhere else, and can never make a non-Vercel production deploy laxer.
 *
 * NOTE: Vercel only injects VERCEL_ENV at runtime when the project's "Automatically
 * expose System Environment Variables" setting is ON. If it is OFF, VERCEL_ENV reads
 * undefined and preview falls back to the strict NODE_ENV branch — i.e. this fix
 * silently no-ops. Confirm that setting is enabled for the project.
 *
 * Lives in lib/core so it is deep-importable from any lib domain (auth, ticketing,
 * security, dev, config) without crossing a boundaries/entry-point rule.
 *
 * Read fresh from process.env on every call (no caching) so tests can flip the env.
 */
export function isRealProduction(): boolean {
  return process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === 'production'
    : process.env.NODE_ENV === 'production';
}
