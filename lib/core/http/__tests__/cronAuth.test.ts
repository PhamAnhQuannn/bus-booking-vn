/**
 * SEC-CRON-AUTH (#562) — shared cron auth: constant-time, fail-closed.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { assertCronAuth } from '../cronAuth';

const saved = process.env.CRON_SECRET;
afterEach(() => {
  if (saved === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = saved;
});

function reqWith(auth?: string) {
  return { headers: { get: (n: string) => (n === 'authorization' ? auth ?? null : null) } };
}

describe('assertCronAuth', () => {
  it('returns null (proceed) for the correct Bearer secret', () => {
    process.env.CRON_SECRET = 'super-secret-cron';
    expect(assertCronAuth(reqWith('Bearer super-secret-cron'))).toBeNull();
  });

  it('401s on a wrong secret', async () => {
    process.env.CRON_SECRET = 'super-secret-cron';
    const res = assertCronAuth(reqWith('Bearer wrong'));
    expect(res?.status).toBe(401);
  });

  it('401s when no Authorization header is present', () => {
    process.env.CRON_SECRET = 'super-secret-cron';
    expect(assertCronAuth(reqWith(undefined))?.status).toBe(401);
  });

  it('fails CLOSED (401) when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET;
    expect(assertCronAuth(reqWith('Bearer anything'))?.status).toBe(401);
    // An empty presented bearer must also not slip through against an unset secret.
    expect(assertCronAuth(reqWith('Bearer '))?.status).toBe(401);
  });
});
