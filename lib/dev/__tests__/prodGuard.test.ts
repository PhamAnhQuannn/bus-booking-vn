/**
 * SEC-DEV-STUB-PROD-SAFETY (#559) — every app/dev/* surface must hard-refuse in production
 * independent of any *_STUB flag. These test the shared guard's three shapes.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

const notFoundMock = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }));
vi.mock('next/navigation', () => ({ notFound: notFoundMock }));

import { devRouteProdGuard, assertDevActionAllowed, assertDevPageAllowed } from '../prodGuard';

afterEach(() => {
  vi.unstubAllEnvs();
  notFoundMock.mockClear();
});
function setNodeEnv(v: string) {
  vi.stubEnv('NODE_ENV', v);
}

describe('devRouteProdGuard', () => {
  it('returns a 404 Response in production', async () => {
    setNodeEnv('production');
    const res = devRouteProdGuard();
    expect(res).not.toBeNull();
    expect(res!.status).toBe(404);
  });
  it('returns null off-production (route proceeds)', () => {
    setNodeEnv('development');
    expect(devRouteProdGuard()).toBeNull();
  });
});

describe('assertDevActionAllowed', () => {
  it('throws in production', () => {
    setNodeEnv('production');
    expect(() => assertDevActionAllowed()).toThrow(/production/);
  });
  it('is a no-op off-production', () => {
    setNodeEnv('test');
    expect(() => assertDevActionAllowed()).not.toThrow();
  });
});

describe('assertDevPageAllowed', () => {
  it('calls notFound() in production', () => {
    setNodeEnv('production');
    expect(() => assertDevPageAllowed()).toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalled();
  });
  it('does nothing off-production', () => {
    setNodeEnv('development');
    assertDevPageAllowed();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
