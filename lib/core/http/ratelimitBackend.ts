/**
 * Which rate-limit backend the runtime will actually use.
 *
 * Single source of truth for that choice: `createRatelimit` (lib/ratelimit) switches on it,
 * and `getEnv`'s in-memory-in-production warning tests it. Two copies of the predicate would
 * drift, and a warning that fires while the backend is genuinely fine is worse than none.
 *
 * Lives in lib/core rather than behind the `@/lib/config` barrel on purpose. Exporting it from
 * that barrel widened lib/ratelimit's module graph through it, and any test doing a PARTIAL
 * `vi.mock('@/lib/config', () => ({ getEnv }))` then resolved this symbol to `undefined` at
 * module load — `app/api/op/charter/[id]/decline/__tests__/route.test.ts` failed to collect for
 * exactly that reason (the 2026-06-03 barrel/partial-mock entry in the mistake log). lib/core is
 * deep-importable by every domain (`eslint.config.mjs` — `{target:["lib-core"], allow:"**"}`), so
 * both consumers import this file directly and no barrel sits in between.
 *
 * Reads raw process.env rather than the parsed schema because `consumeJti`
 * (lib/auth/otpProof.ts) resolves its own client from the same raw vars, and because the
 * Upstash-vars-present fallback below has no schema equivalent.
 */
export function resolveRatelimitBackend(): 'ioredis' | 'upstash' | 'memory' {
  const provider = process.env.REDIS_PROVIDER;

  if (provider === 'ioredis') return 'ioredis';

  // Note the asymmetry with REDIS_PROVIDER: having both Upstash REST vars is enough on its own,
  // even when REDIS_PROVIDER is unset or 'memory'.
  if (
    provider === 'upstash' ||
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ) {
    return 'upstash';
  }

  return 'memory';
}
