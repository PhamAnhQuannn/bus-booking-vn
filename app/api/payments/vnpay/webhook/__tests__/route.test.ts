import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/payment', () => ({
  getVnpayAdapter: vi.fn().mockReturnValue({ verifyWebhook: vi.fn() }),
  processPaymentWebhook: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({
  prisma: { booking: { findUnique: vi.fn() } },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/withErrorHandler', () => ({
  withErrorHandler: (handler: (...args: unknown[]) => unknown) => handler,
}));

import { GET, POST } from '../route';
import { getVnpayAdapter, processPaymentWebhook } from '@/lib/payment';
import { prisma } from '@/lib/core/db/client';

const BODY = 'vnp_Amount=15000000&vnp_ResponseCode=00&vnp_TxnRef=BB-2026-abcd-1234&vnp_SecureHash=deadbeef';

function postRequest(body: string): NextRequest {
  return new NextRequest('https://example.com/api/payments/vnpay/webhook', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded', host: 'example.com' },
  });
}

function getRequest(query: string): NextRequest {
  return new NextRequest(`https://example.com/api/payments/vnpay/webhook?${query}`, {
    method: 'GET',
    headers: { host: 'example.com' },
  });
}

const okEvent = {
  ok: true as const,
  event: {
    orderRef: 'BB-2026-abcd-1234',
    providerTxnId: '14200001',
    amount: 150000,
    currency: 'VND',
    status: 'paid' as const,
  },
};

describe('VNPay IPN webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns RspCode 97 (Invalid Checksum) on signature failure — no processing', async () => {
    vi.mocked(getVnpayAdapter().verifyWebhook).mockReturnValueOnce({ ok: false, reason: 'sig_mismatch' });

    const res = await POST(postRequest(BODY));
    const body = await res.json();

    expect(body.RspCode).toBe('97');
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    expect(processPaymentWebhook).not.toHaveBeenCalled();
  });

  it('returns RspCode 01 (Order not found) when the booking ref is unknown', async () => {
    vi.mocked(getVnpayAdapter().verifyWebhook).mockReturnValueOnce(okEvent);
    vi.mocked(prisma.booking.findUnique).mockResolvedValueOnce(null as never);

    const res = await POST(postRequest(BODY));
    const body = await res.json();

    expect(body.RspCode).toBe('01');
    expect(processPaymentWebhook).not.toHaveBeenCalled();
  });

  it('returns RspCode 00 (Confirm Success) on valid sig + known booking + clean processing', async () => {
    vi.mocked(getVnpayAdapter().verifyWebhook).mockReturnValueOnce(okEvent);
    vi.mocked(prisma.booking.findUnique).mockResolvedValueOnce({ id: 'bk1' } as never);
    vi.mocked(processPaymentWebhook).mockResolvedValueOnce(new Response(null, { status: 200 }));

    const res = await POST(postRequest(BODY));
    const body = await res.json();

    expect(body.RspCode).toBe('00');
    expect(processPaymentWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ adapter: 'vnpay', rawBody: BODY }),
    );
  });

  it('returns RspCode 99 (Unknown error) when processing throws', async () => {
    vi.mocked(getVnpayAdapter().verifyWebhook).mockReturnValueOnce(okEvent);
    vi.mocked(prisma.booking.findUnique).mockResolvedValueOnce({ id: 'bk1' } as never);
    vi.mocked(processPaymentWebhook).mockRejectedValueOnce(new Error('boom'));

    const res = await POST(postRequest(BODY));
    const body = await res.json();

    expect(body.RspCode).toBe('99');
  });

  it('reconstructs the GET query string with all params + encoding fidelity', async () => {
    vi.mocked(getVnpayAdapter().verifyWebhook).mockReturnValueOnce(okEvent);
    vi.mocked(prisma.booking.findUnique).mockResolvedValueOnce({ id: 'bk1' } as never);
    vi.mocked(processPaymentWebhook).mockResolvedValueOnce(new Response(null, { status: 200 }));

    // Include a value that requires URL-encoding (space) to prove round-trip fidelity.
    const query = `${BODY}&vnp_OrderInfo=${encodeURIComponent('Thanh toan ve')}`;
    const res = await GET(getRequest(query));
    const body = await res.json();

    expect(body.RspCode).toBe('00');
    const call = vi.mocked(processPaymentWebhook).mock.calls[0][0] as { rawBody: string };
    // All four core params survive reconstruction.
    expect(call.rawBody).toContain('vnp_TxnRef=BB-2026-abcd-1234');
    expect(call.rawBody).toContain('vnp_Amount=15000000');
    expect(call.rawBody).toContain('vnp_ResponseCode=00');
    expect(call.rawBody).toContain('vnp_SecureHash=deadbeef');
    // Encoded value round-trips (space → %20), not raw or dropped.
    expect(call.rawBody).toContain('vnp_OrderInfo=Thanh%20toan%20ve');
  });
});
