/**
 * Edge middleware tests for the admin forced-redirect guard (issue 056, Layer 1.5).
 *
 * Proves: unauthenticated/invalid/non-TOTP/cross-realm admin page requests
 * redirect to /admin/login; a totpVerified admin session passes; and the free-path
 * allowlist is EXACT-MATCH (a /admin/login-bypass sneak path is NOT auth-free).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { signAdminAccess, signOperatorAccess } from '@/lib/auth/jwt';

const ADMIN_COOKIE = 'bb_admin_access';

let adminTotpToken: string;
let adminNoTotpToken: string;
let operatorToken: string;

beforeAll(async () => {
  adminTotpToken = await signAdminAccess({ sub: 'adm_1', scope: 'admin', role: 'SUPER_ADMIN', totpVerified: true });
  adminNoTotpToken = await signAdminAccess({ sub: 'adm_1', scope: 'admin', role: 'SUPER_ADMIN', totpVerified: false });
  operatorToken = await signOperatorAccess({
    sub: 'op_1',
    scope: 'operator',
    role: 'admin',
    requiresPasswordChange: false,
    operatorId: 'org_1',
  });
});

function get(path: string, token?: string): NextRequest {
  const req = new NextRequest(`https://example.com${path}`, { method: 'GET' });
  if (token) req.cookies.set(ADMIN_COOKIE, token);
  return req;
}

function redirectsToAdminLogin(res: { status: number; headers: Headers }): boolean {
  return res.status === 307 && (res.headers.get('location') ?? '').endsWith('/admin/login');
}

describe('admin middleware guard — redirects', () => {
  it('no admin cookie → redirect to /admin/login', async () => {
    const res = await proxy(get('/admin'));
    expect(redirectsToAdminLogin(res)).toBe(true);
  });

  it('invalid token → redirect', async () => {
    const res = await proxy(get('/admin/dashboard', 'not-a-jwt'));
    expect(redirectsToAdminLogin(res)).toBe(true);
  });

  it('valid admin token but totpVerified=false → redirect (must clear the TOTP step)', async () => {
    const res = await proxy(get('/admin/dashboard', adminNoTotpToken));
    expect(redirectsToAdminLogin(res)).toBe(true);
  });

  it('cross-realm: an operator token in the admin cookie → redirect', async () => {
    const res = await proxy(get('/admin', operatorToken));
    expect(redirectsToAdminLogin(res)).toBe(true);
  });
});

describe('admin middleware guard — admitted', () => {
  it('valid totpVerified admin token → NOT redirected to login', async () => {
    const res = await proxy(get('/admin', adminTotpToken));
    expect(redirectsToAdminLogin(res)).toBe(false);
  });
});

describe('admin free-path allowlist is EXACT-MATCH (issue 010)', () => {
  it('/admin/login passes WITHOUT a cookie', async () => {
    const res = await proxy(get('/admin/login'));
    expect(redirectsToAdminLogin(res)).toBe(false);
  });

  it('/admin/login-bypass does NOT sneak through (redirects without a cookie)', async () => {
    const res = await proxy(get('/admin/login-bypass'));
    expect(redirectsToAdminLogin(res)).toBe(true);
  });
});
