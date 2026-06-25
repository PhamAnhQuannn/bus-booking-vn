import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/config', () => ({
  getEnv: vi.fn().mockReturnValue({ SEPAY_API_KEY: 'test-sepay-key-abc123' }),
}));

vi.mock('@/lib/payment', () => ({
  getBankTransferAdapter: vi.fn().mockReturnValue({
    verifyWebhook: vi.fn(),
  }),
  processPaymentWebhook: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/withErrorHandler', () => ({
  withErrorHandler: (handler: (...args: unknown[]) => unknown) => handler,
}));

import { POST } from '../route';
import { getBankTransferAdapter, processPaymentWebhook } from '@/lib/payment';
import { getEnv } from '@/lib/config';
import { logger } from '@/lib/logger';

function makeRequest(body: string, token?: string): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-proto': 'https',
    'host': 'example.com',
  };
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }
  return new NextRequest('https://example.com/api/payments/bank_transfer/webhook', {
    method: 'POST',
    body,
    headers,
  });
}

const validPayload = JSON.stringify({
  id: 99,
  gateway: 'Agribank',
  transactionDate: '2026-06-24 10:00:00',
  accountNumber: '3516205005863',
  subAccount: null,
  transferType: 'in',
  transferAmount: 150000,
  accumulated: 500000,
  code: null,
  content: 'BB-2026-abcd-ef01 bus ticket',
  referenceCode: null,
  description: 'transfer',
});

describe('POST /api/payments/bank_transfer/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(401);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('returns 401 when bearer token is invalid', async () => {
    const res = await POST(makeRequest(validPayload, 'wrong-token'));
    expect(res.status).toBe(401);
    expect(logger.warn).toHaveBeenCalledWith(
      { adapter: 'bank_transfer' },
      'payment.bank_transfer.webhook.invalid_bearer',
    );
  });

  it('returns 401 when SEPAY_API_KEY is not configured', async () => {
    vi.mocked(getEnv).mockReturnValueOnce({ SEPAY_API_KEY: '' } as ReturnType<typeof getEnv>);
    const res = await POST(makeRequest(validPayload, 'test-sepay-key-abc123'));
    expect(res.status).toBe(401);
  });

  it('returns 200 no-op when memo has no booking ref', async () => {
    const adapter = getBankTransferAdapter();
    vi.mocked(adapter.verifyWebhook).mockReturnValueOnce({
      ok: false,
      reason: 'no_booking_ref_in_memo',
    });

    const res = await POST(makeRequest(validPayload, 'test-sepay-key-abc123'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('ok');
    expect(processPaymentWebhook).not.toHaveBeenCalled();
  });

  it('delegates to processPaymentWebhook on valid auth + valid payload', async () => {
    const adapter = getBankTransferAdapter();
    vi.mocked(adapter.verifyWebhook).mockReturnValueOnce({
      ok: true,
      event: {
        orderRef: 'bb-2026-abcd-ef01',
        providerTxnId: '99',
        amount: 150000,
        currency: 'VND',
        status: 'paid',
      },
    });
    vi.mocked(processPaymentWebhook).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'ok' }), { status: 200 }),
    );

    const res = await POST(makeRequest(validPayload, 'test-sepay-key-abc123'));
    expect(res.status).toBe(200);
    expect(processPaymentWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        adapter: 'bank_transfer',
        rawBody: validPayload,
        proto: 'https',
      }),
    );
  });

  it('delegates to processPaymentWebhook when pre-verify fails for non-memo reason', async () => {
    const adapter = getBankTransferAdapter();
    vi.mocked(adapter.verifyWebhook).mockReturnValueOnce({
      ok: false,
      reason: 'invalid_amount',
    });
    vi.mocked(processPaymentWebhook).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'INVALID_SIGNATURE' }), { status: 400 }),
    );

    const res = await POST(makeRequest(validPayload, 'test-sepay-key-abc123'));
    expect(res.status).toBe(400);
    expect(processPaymentWebhook).toHaveBeenCalled();
  });
});
