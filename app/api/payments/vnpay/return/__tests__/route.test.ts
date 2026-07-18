import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/payment', () => ({
  getVnpayAdapter: vi.fn().mockReturnValue({ verifyWebhook: vi.fn() }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from '../route';
import { getVnpayAdapter } from '@/lib/payment';

function returnRequest(query: string): NextRequest {
  return new NextRequest(`https://example.com/api/payments/vnpay/return?${query}`, {
    method: 'GET',
    headers: { host: 'example.com' },
  });
}

function locationOf(res: Response): string {
  return res.headers.get('location') ?? '';
}

const paidEvent = {
  ok: true as const,
  event: { orderRef: 'BB-2026-abcd-1234', providerTxnId: '1', amount: 150000, currency: 'VND', status: 'paid' as const },
};

describe('VNPay browser return route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to payment-error (sig_invalid) when the signature is invalid', () => {
    vi.mocked(getVnpayAdapter().verifyWebhook).mockReturnValueOnce({ ok: false, reason: 'sig_mismatch' });

    const res = GET(returnRequest('vnp_TxnRef=BB-2026-abcd-1234&vnp_ResponseCode=00'));

    expect(res.status).toBe(307);
    expect(locationOf(res)).toContain('/booking/payment-error');
    expect(locationOf(res)).toContain('reason=sig_invalid');
  });

  it('redirects to payment-error (invalid_amount) on a validly-signed zero amount', () => {
    vi.mocked(getVnpayAdapter().verifyWebhook).mockReturnValueOnce({
      ...paidEvent,
      event: { ...paidEvent.event, amount: 0 },
    });

    const res = GET(returnRequest('vnp_TxnRef=BB-2026-abcd-1234&vnp_ResponseCode=00'));

    expect(locationOf(res)).toContain('/booking/payment-error');
    expect(locationOf(res)).toContain('reason=invalid_amount');
  });

  it('redirects to payment-pending on a valid sig with a non-success response code', () => {
    vi.mocked(getVnpayAdapter().verifyWebhook).mockReturnValueOnce(paidEvent);

    const res = GET(returnRequest('vnp_TxnRef=BB-2026-abcd-1234&vnp_ResponseCode=24'));

    expect(locationOf(res)).toContain('/booking/payment-pending');
    expect(locationOf(res)).toContain('code=24');
  });

  it('redirects to confirmation on valid sig + response code 00', () => {
    vi.mocked(getVnpayAdapter().verifyWebhook).mockReturnValueOnce(paidEvent);

    const res = GET(returnRequest('vnp_TxnRef=BB-2026-abcd-1234&vnp_ResponseCode=00'));

    expect(locationOf(res)).toContain('/booking/confirmation');
    expect(locationOf(res)).toContain('ref=BB-2026-abcd-1234');
  });
});
