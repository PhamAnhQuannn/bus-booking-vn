/**
 * Unit tests for lib/auth/requireCustomerAuth.ts
 * verifyAccess uses the 'a'.repeat(32) test-secret fallback. The prisma client is
 * mocked: requireCustomerAuth re-reads the Customer row for the Issue 066 suspension
 * gate, so each test controls what customer.findUnique resolves to.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';

// Mock the prisma singleton so the real client (needs DATABASE_URL) is never built.
// findUnique default: returns a non-suspended row for whatever id is queried.
const findUnique = vi.fn();
vi.mock('@/lib/core/db/client', () => ({ prisma: { customer: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

beforeEach(() => {
  delete process.env.JWT_SECRET;
  // Default: an existing, non-suspended customer matching the queried id.
  findUnique.mockReset();
  findUnique.mockImplementation(async (args: { where: { id: string } }) => ({
    id: args.where.id,
    suspendedAt: null,
  }));
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

  it('returns 403 ACCOUNT_SUSPENDED when the customer is admin-suspended (Issue 066)', async () => {
    const { signAccess } = await import('../jwt');
    const { requireCustomerAuth } = await import('../requireCustomerAuth');
    const token = await signAccess({ sub: 'cust-susp', role: 'customer' });
    findUnique.mockResolvedValueOnce({ id: 'cust-susp', suspendedAt: new Date() });

    const handler = vi.fn();
    const wrapped = requireCustomerAuth()(handler);
    const res = await wrapped(reqWithAuth(`Bearer ${token}`));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'ACCOUNT_SUSPENDED' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 when the customer row no longer exists (deleted id)', async () => {
    const { signAccess } = await import('../jwt');
    const { requireCustomerAuth } = await import('../requireCustomerAuth');
    const token = await signAccess({ sub: 'cust-gone', role: 'customer' });
    findUnique.mockResolvedValueOnce(null);

    const handler = vi.fn();
    const wrapped = requireCustomerAuth()(handler);
    const res = await wrapped(reqWithAuth(`Bearer ${token}`));
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
