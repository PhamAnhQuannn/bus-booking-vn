/**
 * Unit tests for POST /api/auth/logout
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLogout, mockCookieStore } = vi.hoisted(() => {
  const mockCookieStore = {
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(),
    delete: vi.fn(),
  };
  return { mockLogout: vi.fn(), mockCookieStore };
});

vi.mock('@/lib/auth/authService', () => ({ logout: mockLogout }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/auth/logout', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'some-refresh-token' });
  mockLogout.mockResolvedValue(undefined);
});

describe('POST /api/auth/logout', () => {
  it('returns 200 success', async () => {
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('calls logout with the token from bb_rt cookie', async () => {
    await POST(makeRequest());
    expect(mockLogout).toHaveBeenCalledWith('some-refresh-token');
  });

  it('clears bb_rt cookie with maxAge 0', async () => {
    await POST(makeRequest());
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'bb_rt',
      '',
      expect.objectContaining({ maxAge: 0 })
    );
  });

  it('returns 200 even without bb_rt cookie (idempotent)', async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
