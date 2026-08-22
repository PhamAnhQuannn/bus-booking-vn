/**
 * Unit tests for isRealProduction() (#643).
 *
 * VERCEL_ENV (when set) is the authority: only 'production' is strict. When unset
 * (self-host / CI / local), fall back to NODE_ENV==='production'.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { isRealProduction } from '../deployTier';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isRealProduction', () => {
  it('true when VERCEL_ENV=production (regardless of NODE_ENV)', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isRealProduction()).toBe(true);
  });

  it('false when VERCEL_ENV=preview (even though Vercel sets NODE_ENV=production)', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isRealProduction()).toBe(false);
  });

  it('false when VERCEL_ENV=development', () => {
    vi.stubEnv('VERCEL_ENV', 'development');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isRealProduction()).toBe(false);
  });

  it('falls back to NODE_ENV=production when VERCEL_ENV is unset (self-host)', () => {
    vi.stubEnv('VERCEL_ENV', undefined);
    vi.stubEnv('NODE_ENV', 'production');
    expect(isRealProduction()).toBe(true);
  });

  it('false when VERCEL_ENV unset and NODE_ENV=test', () => {
    vi.stubEnv('VERCEL_ENV', undefined);
    vi.stubEnv('NODE_ENV', 'test');
    expect(isRealProduction()).toBe(false);
  });

  it('false when VERCEL_ENV unset and NODE_ENV=development', () => {
    vi.stubEnv('VERCEL_ENV', undefined);
    vi.stubEnv('NODE_ENV', 'development');
    expect(isRealProduction()).toBe(false);
  });
});
