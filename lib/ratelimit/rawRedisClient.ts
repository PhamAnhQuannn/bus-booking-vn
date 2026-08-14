/**
 * Raw Redis client acquisition for the Gemini cost controls (breaker + usage accounting).
 *
 * These need low-level ops (INCR/EXPIRE/TTL/SET-EX/INCRBY) that the sliding-window Ratelimit
 * abstraction doesn't expose, so they talk to Redis directly — the same escape hatch consumeJti
 * (lib/auth/otpProof.ts) uses. Backend is chosen by the caller via resolveRatelimitBackend(); this
 * module only builds the client for the ioredis / upstash cases (memory has no client).
 */

import type IORedisType from 'ioredis';

let _redisPromise: Promise<IORedisType> | null = null;

/** Lazily-connected, process-cached ioredis client (self-hosted TCP Redis). */
export async function rawIoRedis(): Promise<IORedisType> {
  if (_redisPromise) return _redisPromise;
  _redisPromise = (async () => {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const { default: IORedis } = await import('ioredis');
    const redis = new IORedis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    try {
      await redis.connect();
    } catch (err) {
      _redisPromise = null; // let the next call retry a fresh connect
      throw err;
    }
    return redis;
  })();
  return _redisPromise;
}

/** Upstash REST client (Vercel/serverless). Cheap to construct per call — it's stateless HTTP. */
export async function rawUpstash() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}
