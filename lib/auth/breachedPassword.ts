/**
 * Breached-password check via HIBP Pwned Passwords k-anonymity range API (#497).
 *
 * Privacy: only the first 5 hex chars of the password's SHA-1 leave the server
 * (GET https://api.pwnedpasswords.com/range/{prefix}, Cloudflare-hosted). The response
 * lists every known suffix in that bucket; the match is done locally. `Add-Padding: true`
 * makes HIBP pad the response with fake `suffix:0` lines so the response size does not
 * reveal the bucket — padding lines (count 0) are ignored.
 *
 * FAIL-OPEN: a timeout, 5xx/429, network error, or an open breaker returns `false`
 * (not breached). This is a defense-in-depth signal, not an availability gate — an HIBP
 * outage must never block register / reset / change-password. Logs carry only the
 * HTTP status or error name — never the password, its digest, or the prefix.
 *
 * Gate: HIBP_ENABLED. Unset → on only when NODE_ENV=production, so unit/int tests and
 * the e2e dev server never hit the network. Read from process.env directly (like
 * AUTH_ARGON2_ENABLED in password.ts); declared in lib/config/env.ts for documentation.
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { createBreaker } from '@/lib/ratelimit';

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const HIBP_TIMEOUT_MS = 1500;

const hibpBreaker = createBreaker('hibp');

export function isHibpEnabled(): boolean {
  const raw = process.env.HIBP_ENABLED;
  if (raw !== undefined && raw !== '') return raw === 'true';
  return process.env.NODE_ENV === 'production';
}

/** True only when HIBP positively reports the password in a breach (count > 0). */
export async function isPasswordBreached(password: string): Promise<boolean> {
  if (!isHibpEnabled()) return false;

  const breaker = await hibpBreaker.breakerState();
  if (breaker.open) {
    logger.warn({ retryAfter: breaker.retryAfter }, 'auth.hibp.breaker_open — fail-open');
    return false;
  }

  const passwordSha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = passwordSha1.slice(0, 5);
  const suffix = passwordSha1.slice(5);

  let body: string;
  try {
    const res = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(HIBP_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) {
      if (res.status >= 500 || res.status === 429) await hibpBreaker.recordUpstreamFailure();
      logger.warn({ status: res.status }, 'auth.hibp.http_error — fail-open');
      return false;
    }
    body = await res.text();
  } catch (err) {
    await hibpBreaker.recordUpstreamFailure();
    logger.warn({ errName: err instanceof Error ? err.name : 'unknown' }, 'auth.hibp.request_failed — fail-open');
    return false;
  }
  await hibpBreaker.recordUpstreamSuccess();

  for (const line of body.split('\n')) {
    const [lineSuffix, count] = line.trim().split(':');
    if (lineSuffix?.toUpperCase() === suffix && Number(count) > 0) return true;
  }
  return false;
}
