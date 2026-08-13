/**
 * SEC-BASEURL (#565) — resolveBaseUrl prefers the trusted env origin and only falls back to the
 * (spoofable) request host when NEXT_PUBLIC_BASE_URL is unset.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resolveBaseUrl } from '../baseUrl';

function reqWith(headers: Record<string, string>, url = 'http://internal.local/api/x'): NextRequest {
  return new NextRequest(url, { headers });
}

afterEach(() => vi.unstubAllEnvs());

describe('resolveBaseUrl', () => {
  it('uses NEXT_PUBLIC_BASE_URL and ignores a spoofed Host when the env is set', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://lenxevn.com');
    const url = resolveBaseUrl(reqWith({ host: 'evil.tld', 'x-forwarded-host': 'evil.tld' }));
    expect(url).toBe('https://lenxevn.com');
  });

  it('trims a trailing slash on the env value', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://lenxevn.com/');
    expect(resolveBaseUrl(reqWith({}))).toBe('https://lenxevn.com');
  });

  it('falls back to the request origin only when the env is unset (dev)', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', '');
    const url = resolveBaseUrl(reqWith({}, 'http://localhost:3001/api/x'));
    expect(url).toBe('http://localhost:3001');
  });

  it('honours x-forwarded-proto/host in the fallback path', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', '');
    const url = resolveBaseUrl(
      reqWith({ 'x-forwarded-proto': 'https', 'x-forwarded-host': 'fwd.example' }, 'http://localhost:3001/x'),
    );
    expect(url).toBe('https://fwd.example');
  });
});
