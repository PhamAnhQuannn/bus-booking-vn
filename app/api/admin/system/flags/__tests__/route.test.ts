/**
 * Unit tests for POST /api/admin/system/flags (Issue 070) — feature-flag toggle.
 *
 * Mocks setFlag, prisma, and the auth HOFs (requireAdminAuth + requireStepUp as
 * passthroughs). Asserts: the route composes SUPER_ADMIN|FINANCE auth + a fresh
 * step-up; a known FLAG_KEYS key calls setFlag with { key, enabled, actor } and
 * returns 200; an UNKNOWN key → 422 with setFlag never called; a malformed body →
 * 400. The gates themselves are unit-tested in their own modules.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSetFlag, stepUpComposed, authOptions } = vi.hoisted(() => ({
  mockSetFlag: vi.fn(),
  stepUpComposed: { called: false },
  authOptions: { value: undefined as unknown },
}));

vi.mock('@/lib/flags/flags', () => ({ setFlag: mockSetFlag }));
vi.mock('@/lib/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/auth/requireAdminAuth', () => ({
  requireAdminAuth: (opts: unknown) => {
    authOptions.value = opts;
    return (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
      (req: unknown) => handler(req, { adminId: 'super-1', role: 'SUPER_ADMIN', totpVerified: true });
  },
}));
vi.mock('@/lib/auth/requireStepUp', () => ({
  requireStepUp: (handler: (req: unknown, ctx: unknown) => Promise<Response>) => {
    stepUpComposed.called = true;
    return handler;
  },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { FLAG_KEYS } from '@/lib/flags/keys';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/system/flags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSetFlag.mockResolvedValue(undefined);
});

describe('POST /api/admin/system/flags', () => {
  it('composes SUPER_ADMIN|FINANCE auth + a fresh step-up', () => {
    expect(authOptions.value).toMatchObject({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] });
    expect(stepUpComposed.called).toBe(true);
  });

  it('calls setFlag with a known key + actor and returns 200', async () => {
    const res = await POST(makeRequest({ key: FLAG_KEYS.RAIL_MOMO_ENABLED, enabled: false }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockSetFlag).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        key: FLAG_KEYS.RAIL_MOMO_ENABLED,
        enabled: false,
        actor: 'admin:super-1',
      })
    );
  });

  it('returns 422 on an unknown flag key and never calls setFlag', async () => {
    const res = await POST(makeRequest({ key: 'rail.bitcoin.enabled', enabled: true }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'UNKNOWN_FLAG' });
    expect(mockSetFlag).not.toHaveBeenCalled();
  });

  it('returns 400 on a malformed body', async () => {
    const res = await POST(makeRequest({ key: FLAG_KEYS.KILLSWITCH_BOOKING }));
    expect(res.status).toBe(400);
    expect(mockSetFlag).not.toHaveBeenCalled();
  });
});
