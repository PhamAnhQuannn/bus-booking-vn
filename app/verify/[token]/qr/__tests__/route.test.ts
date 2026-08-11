/**
 * Unit test for GET /verify/[token]/qr — the receipt QR PNG.
 * Mocks verifyTicketToken; ticketQrMatrix + sharp run for real (native PNG smoke).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerify } = vi.hoisted(() => ({ mockVerify: vi.fn() }));

vi.mock('@/lib/ticketing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ticketing')>();
  return { ...actual, verifyTicketToken: mockVerify };
});

import { GET } from '../route';

function req(origin = 'https://lenxevn.com') {
  return { nextUrl: { origin } } as never;
}

describe('GET /verify/[token]/qr', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a PNG for a valid token', async () => {
    mockVerify.mockResolvedValue({ ref: 'BB-2026-ab12-cd34', ct: 'ct' });
    const res = await GET(req(), { params: Promise.resolve({ token: 'good.token' }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    const buf = Buffer.from(await res.arrayBuffer());
    // PNG magic number.
    expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(buf.length).toBeGreaterThan(100);
  });

  it('404s for an invalid/tampered token (no QR minted)', async () => {
    mockVerify.mockResolvedValue(null);
    const res = await GET(req(), { params: Promise.resolve({ token: 'bad' }) });
    expect(res.status).toBe(404);
  });
});
