/**
 * [SYS20] lib/core/retry — bounded retry with full jitter.
 *
 * Written for #362: `createHold` retries a whole transaction when it cannot take the
 * trip advisory lock. There was no backoff/jitter helper anywhere in `lib/**` — the only
 * `backoffMs` (lib/notification/dispatchNotifications.ts) computes a DB-persisted
 * `nextAttemptAt` for a cron to reclaim later, has no jitter, and is not a sleep.
 *
 * Deliberately NOT for cron jobs. `lib/jobs/withAdvisoryLock.ts` returns `skipped_locked`
 * and waits for the next tick, which is the correct behaviour for a job core — do not
 * generalise this into it.
 */

/**
 * FULL jitter — `random() * base`, not `base + random()`.
 *
 * Additive jitter keeps every waiter in the same ballpark, so a herd released by one
 * lock holder re-collides on the next tick. Full jitter spreads retries across the whole
 * interval, which is the property that actually breaks lockstep. See the "thundering
 * herd / seat-map-busy storms" risk called out on #362.
 */
export function jitteredDelayMs(attempt: number, baseMs: number): number {
  const ceiling = baseMs * 2 ** (attempt - 1);
  return Math.random() * ceiling;
}

export interface BoundedRetryOptions {
  /** Total attempts including the first. */
  attempts: number;
  /** First backoff ceiling in ms; doubles per attempt before jitter. */
  baseMs: number;
  /** Only these errors are retried. Everything else propagates immediately. */
  retryOn: (err: unknown) => boolean;
}

/**
 * Run `fn`, retrying only errors `retryOn` accepts, up to `attempts` times.
 *
 * The sleep happens OUTSIDE `fn`, which is what makes this safe for the hold path: a
 * waiting retry holds no transaction and therefore no pooled connection. That is the
 * entire point of replacing the blocking advisory lock — a blocked waiter pins a
 * connection, a sleeping retry does not.
 *
 * The final attempt's error propagates unchanged, so the caller sees the real typed
 * error (e.g. SeatMapBusyError) rather than a wrapper.
 */
export async function withBoundedRetry<T>(
  fn: () => Promise<T>,
  opts: BoundedRetryOptions
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!opts.retryOn(err)) throw err;
      lastErr = err;
      if (attempt < opts.attempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, jitteredDelayMs(attempt, opts.baseMs))
        );
      }
    }
  }

  throw lastErr;
}
