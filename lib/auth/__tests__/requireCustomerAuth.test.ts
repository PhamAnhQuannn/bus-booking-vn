/**
 * Unit tests for lib/auth/requireCustomerAuth.ts
 * No DB — verifyAccess uses the 'a'.repeat(32) test-secret fallback.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';

beforeEach(() => {
  delete process.env.JWT_SECRET;
});
afterEach(() => {
  delete process.env.JWT_SECRET;
});

function reqWithAuth(header: string | null): NextRequest {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? header : null) },
  } as unknown as NextRequest;
}

describe('requireCustomerAuth', () => {
  it('passes customerId from a valid Bearer token to the handler', async () => {
    const { signAccess } = await import('../jwt');
    const { requireCustomerAuth } = await import('../requireCustomerAuth');
    const token = await signAccess({ sub: 'cust-abc', role: 'customer' });

    const handler = vi.fn(async (_req: NextRequest, _ctx: { customerId: string }) =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const wrapped = requireCustomerAuth()(handler);
    const res = await wrapped(reqWithAuth(`Bearer ${token}`));

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][1]).toEqual({ customerId: 'cust-abc' });
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const { requireCustomerAuth } = await import('../requireCustomerAuth');
    const handler = vi.fn();
    const wrapped = requireCustomerAuth()(handler);
    const res = await wrapped(reqWithAuth(null));
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 when the header is not a Bearer scheme', async () => {
    const { requireCustomerAuth } = await import('../requireCustomerAuth');
    const handler = vi.fn();
    const wrapped = requireCustomerAuth()(handler);
    const res = await wrapped(reqWithAuth('Basic abc123'));
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 for a tampered token', async () => {
    const { signAccess } = await import('../jwt');
    const { requireCustomerAuth } = await import('../requireCustomerAuth');
    const token = await signAccess({ sub: 'cust-x', role: 'customer' });
    const parts = token.split('.');
    const chars = parts[1].split('');
    chars[0] = chars[0] === 'A' ? 'B' : 'A';
    parts[1] = chars.join('');

    const handler = vi.fn();
    const wrapped = requireCustomerAuth()(handler);
    const res = await wrapped(reqWithAuth(`Bearer ${parts.join('.')}`));
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 for an operator-scoped token (cross-scope guard)', async () => {
    const { signOperatorAccess } = await import('../jwt');
    const { requireCustomerAuth } = await import('../requireCustomerAuth');
    const opToken = await signOperatorAccess({
      sub: 'op-1',
      scope: 'operator',
      role: 'admin',
      requiresPasswordChange: false,
      operatorId: 'org-1',
    });

    const handler = vi.fn();
    const wrapped = requireCustomerAuth()(handler);
    const res = await wrapped(reqWithAuth(`Bearer ${opToken}`));
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('getCustomerOptional (Issue 031)', () => {
  it('returns the customerId for a valid Bearer token', async () => {
    const { signAccess } = await import('../jwt');
    const { getCustomerOptional } = await import('../requireCustomerAuth');
    const token = await signAccess({ sub: 'cust-opt', role: 'customer' });

    const result = await getCustomerOptional(reqWithAuth(`Bearer ${token}`));
    expect(result).toBe('cust-opt');
  });

  it('returns null when the Authorization header is absent (guest)', async () => {
    const { getCustomerOptional } = await import('../requireCustomerAuth');
    expect(await getCustomerOptional(reqWithAuth(null))).toBeNull();
  });

  it('returns null for a non-Bearer scheme', async () => {
    const { getCustomerOptional } = await import('../requireCustomerAuth');
    expect(await getCustomerOptional(reqWithAuth('Basic abc'))).toBeNull();
  });

  it('returns null for a tampered token (never throws)', async () => {
    const { signAccess } = await import('../jwt');
    const { getCustomerOptional } = await import('../requireCustomerAuth');
    const token = await signAccess({ sub: 'cust-y', role: 'customer' });
    const parts = token.split('.');
    const chars = parts[1].split('');
    chars[0] = chars[0] === 'A' ? 'B' : 'A';
    parts[1] = chars.join('');

    expect(await getCustomerOptional(reqWithAuth(`Bearer ${parts.join('.')}`))).toBeNull();
  });

  it('returns null for an operator-scoped token (cross-scope guard)', async () => {
    const { signOperatorAccess } = await import('../jwt');
    const { getCustomerOptional } = await import('../requireCustomerAuth');
    const opToken = await signOperatorAccess({
      sub: 'op-1',
      scope: 'operator',
      role: 'admin',
      requiresPasswordChange: false,
      operatorId: 'org-1',
    });
    expect(await getCustomerOptional(reqWithAuth(`Bearer ${opToken}`))).toBeNull();
  });
});
