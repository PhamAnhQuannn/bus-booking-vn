/**
 * Unit tests for lib/auth/requireAdminPage.ts (Issue 064).
 *
 * Mocks: next/headers cookies(), next/navigation redirect(), verifyAdminAccess.
 *
 * redirect() is mocked to THROW (mirroring Next's real control-flow — redirect
 * throws a NEXT_REDIRECT error that unwinds the render), so the assertions both
 * confirm the target path AND that execution does not fall through to the return.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCookieStore = vi.hoisted(() => ({ get: vi.fn() }));
const mockRedirect = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  })
);
const mockVerifyAdminAccess = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));
vi.mock('../jwt', () => ({ verifyAdminAccess: mockVerifyAdminAccess }));

import { requireAdminPage } from '../requireAdminPage';

const VALID_PAYLOAD = {
  sub: 'admin_123',
  scope: 'admin' as const,
  role: 'FINANCE' as const,
  totpVerified: true,
};

describe('requireAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockImplementation((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    });
  });

  it('returns ctx on a valid totpVerified admin cookie', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'good.jwt' });
    mockVerifyAdminAccess.mockResolvedValue(VALID_PAYLOAD);

    const ctx = await requireAdminPage();

    expect(ctx).toEqual({ adminId: 'admin_123', role: 'FINANCE', totpVerified: true });
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockVerifyAdminAccess).toHaveBeenCalledWith('good.jwt');
  });

  it('redirects to /admin/login when the cookie is missing', async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    await expect(requireAdminPage()).rejects.toThrow('NEXT_REDIRECT:/admin/login');
    expect(mockRedirect).toHaveBeenCalledWith('/admin/login');
    expect(mockVerifyAdminAccess).not.toHaveBeenCalled();
  });

  it('redirects to /admin/login when the token is invalid (verify returns null)', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'bad.jwt' });
    mockVerifyAdminAccess.mockResolvedValue(null);

    await expect(requireAdminPage()).rejects.toThrow('NEXT_REDIRECT:/admin/login');
    expect(mockRedirect).toHaveBeenCalledWith('/admin/login');
  });

  it('redirects to /admin/login when totpVerified is false', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'half.jwt' });
    mockVerifyAdminAccess.mockResolvedValue({ ...VALID_PAYLOAD, totpVerified: false });

    await expect(requireAdminPage()).rejects.toThrow('NEXT_REDIRECT:/admin/login');
    expect(mockRedirect).toHaveBeenCalledWith('/admin/login');
  });

  it('passes through the admin role (SUPER_ADMIN) for role-aware rendering', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'good.jwt' });
    mockVerifyAdminAccess.mockResolvedValue({ ...VALID_PAYLOAD, role: 'SUPER_ADMIN' });

    const ctx = await requireAdminPage();
    expect(ctx.role).toBe('SUPER_ADMIN');
  });
});
