/**
 * Issue 082: unit tests for POST /api/charter/[ref]/cancel (public ref-keyed cancel).
 * getCharterByRef + transitionCharterRequest are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetByRef, mockTransition } = vi.hoisted(() => ({
  mockGetByRef: vi.fn(),
  mockTransition: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/charter', async () => {
  const actual = await vi.importActual<typeof import('@/lib/charter')>('@/lib/charter');
  return {
    ...actual,
    getCharterByRef: mockGetByRef,
    transitionCharterRequest: mockTransition,
  };
});

import { POST } from '../route';
import { CharterError } from '@/lib/charter';
import { NextRequest } from 'next/server';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/charter/CH-2026-ABC123/cancel', { method: 'POST' });
}

function ctx(ref: string) {
  return { params: Promise.resolve({ ref }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/charter/[ref]/cancel', () => {
  it('cancels a pre-ACCEPT request (200, status CANCELLED)', async () => {
    mockGetByRef.mockResolvedValue({ id: 'ch_1', ref: 'CH-2026-ABC123', status: 'ADMIN_REVIEW' });
    mockTransition.mockResolvedValue({ ok: true, to: 'CANCELLED' });

    const res = await POST(makeRequest(), ctx('CH-2026-ABC123'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('CANCELLED');
    expect(mockTransition).toHaveBeenCalledWith(expect.anything(), { charterId: 'ch_1', to: 'CANCELLED' });
  });

  it('returns 422 when the request is already ACCEPTED (not customer-cancellable)', async () => {
    mockGetByRef.mockResolvedValue({ id: 'ch_1', ref: 'CH-2026-ABC123', status: 'ACCEPTED' });

    const res = await POST(makeRequest(), ctx('CH-2026-ABC123'));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('CANNOT_CANCEL');
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it('returns 422 for a terminal (COMPLETED) request', async () => {
    mockGetByRef.mockResolvedValue({ id: 'ch_1', ref: 'CH-2026-ABC123', status: 'COMPLETED' });
    const res = await POST(makeRequest(), ctx('CH-2026-ABC123'));
    expect(res.status).toBe(422);
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it('returns 404 when no charter matches the ref', async () => {
    mockGetByRef.mockResolvedValue(null);
    const res = await POST(makeRequest(), ctx('CH-2026-NONONO'));
    expect(res.status).toBe(404);
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it('returns 422 on a race (illegal_transition thrown by the locked transition)', async () => {
    mockGetByRef.mockResolvedValue({ id: 'ch_1', ref: 'CH-2026-ABC123', status: 'PUBLISHED' });
    mockTransition.mockRejectedValue(new CharterError('illegal_transition', 'ACCEPTED -> CANCELLED'));

    const res = await POST(makeRequest(), ctx('CH-2026-ABC123'));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('CANNOT_CANCEL');
  });
});
