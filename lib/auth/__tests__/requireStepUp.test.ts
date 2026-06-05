/**
 * Unit tests for lib/auth/requireStepUp.ts (Issue 055).
 * Mocks next/headers cookies; uses the REAL jwt sign/verify (jose works in Node).
 *
 * Asserts: 403 STEP_UP_REQUIRED without a cookie, 403 on a token whose sub doesn't
 * match the authed admin, and passthrough (handler runs) with a valid step-up cookie.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { requireStepUp } from '../requireStepUp';
import { signAdminStepUp } from '../jwt';
import { NextRequest } from 'next/server';
import type { AdminAuthContext } from '../requireAdminAuth';

const CTX: AdminAuthContext = { adminId: 'admin-1', role: 'FINANCE', totpVerified: true };

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/admin/finance/thing', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.JWT_SECRET; // use the test fallback secret
});

describe('requireStepUp', () => {
  it('rejects with 403 STEP_UP_REQUIRED when the step-up cookie is absent', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const handler = vi.fn();
    const wrapped = requireStepUp(handler);

    const res = await wrapped(makeReq(), CTX);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toBe('STEP_UP_REQUIRED');
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects with 403 when the step-up token sub does not match the authed admin', async () => {
    const token = await signAdminStepUp('SOMEONE-ELSE');
    mockCookieStore.get.mockReturnValue({ value: token });
    const handler = vi.fn();
    const wrapped = requireStepUp(handler);

    const res = await wrapped(makeReq(), CTX);
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes through to the handler with a valid step-up cookie for the same admin', async () => {
    const token = await signAdminStepUp('admin-1');
    mockCookieStore.get.mockReturnValue({ value: token });
    const handler = vi.fn(
      async (_req: NextRequest, _ctx: AdminAuthContext) => new Response('ok', { status: 200 })
    );
    const wrapped = requireStepUp(handler);

    const res = await wrapped(makeReq(), CTX);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    // ctx threaded through unchanged.
    expect(handler.mock.calls[0][1]).toBe(CTX);
  });
});
