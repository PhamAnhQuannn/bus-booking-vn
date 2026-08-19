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
  recordUnmatchedPaymentEvent: vi.fn(),
  // Route now branches on the shared constant (real values, not a stub) so the
  // reason comparisons + persisted unmatchedReason keep matching the fixtures.
  UNMATCHED_REASON: {
    ACCOUNT_MISMATCH: 'account_mismatch',
    NO_BOOKING_REF: 'no_booking_ref_in_memo',
    BOOKING_NOT_FOUND: 'booking_not_found',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/observability', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/withErrorHandler', () => ({
  withErrorHandler: (handler: (...args: unknown[]) => unknown) => handler,
}));

import { POST } from '../route';
import {
  getBankTransferAdapter,
  processPaymentWebhook,
  recordUnmatchedPaymentEvent,
} from '@/lib/payment';
import { getEnv } from '@/lib/config';
import { logger } from '@/lib/logger';
import { captureException } from '@/lib/observability';

function makeRequest(body: string, token?: string, scheme = 'Bearer'): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-proto': 'https',
    'host': 'example.com',
  };
  if (token) {
    headers['authorization'] = `${scheme} ${token}`;
  }
  return new NextRequest('https://example.com/api/payments/bank_transfer/webhook', {
    method: 'POST',
    body,
    headers,
  });
}

const validPayload = JSON.stringify({
  id: 99,
  gateway: 'Sacombank',
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

  it('returns 401 when bearer token is invalid, and escalates it', async () => {
    // error + captureException, not warn (#361). The static key is the entire
    // perimeter — SePay offers no body signature — and SePay only ever presents the
    // correct key, so a wrong one is a misconfiguration or a probe, never routine.
    const res = await POST(makeRequest(validPayload, 'wrong-token'));
    expect(res.status).toBe(401);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ adapter: 'bank_transfer' }),
      expect.stringContaining('payment.bank_transfer.webhook.invalid_bearer'),
    );
    expect(captureException).toHaveBeenCalled();
  });

  it('never logs the presented token (leaks key material / its length)', async () => {
    await POST(makeRequest(validPayload, 'wrong-token-abcdef'));

    const logged = JSON.stringify([
      ...vi.mocked(logger.error).mock.calls,
      ...vi.mocked(logger.warn).mock.calls,
      ...vi.mocked(captureException).mock.calls,
    ]);
    expect(logged).not.toContain('wrong-token-abcdef');
    expect(logged).not.toContain('test-sepay-key-abc123');
  });

  it('returns 401 when SEPAY_API_KEY is not configured', async () => {
    vi.mocked(getEnv).mockReturnValueOnce({ SEPAY_API_KEY: '' } as ReturnType<typeof getEnv>);
    const res = await POST(makeRequest(validPayload, 'test-sepay-key-abc123'));
    expect(res.status).toBe(401);
  });

  it('accepts SePay\'s "Apikey" auth scheme', async () => {
    const adapter = getBankTransferAdapter();
    vi.mocked(adapter.verifyWebhook).mockReturnValueOnce({
      ok: false,
      reason: 'no_booking_ref_in_memo',
    });

    const res = await POST(makeRequest(validPayload, 'test-sepay-key-abc123', 'Apikey'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
  });

  it('returns 401 when the auth scheme is unrecognised', async () => {
    const res = await POST(makeRequest(validPayload, 'test-sepay-key-abc123', 'Basic'));
    expect(res.status).toBe(401);
  });

  it('returns 200 no-op with SePay ack shape when memo has no booking ref', async () => {
    const adapter = getBankTransferAdapter();
    vi.mocked(adapter.verifyWebhook).mockReturnValueOnce({
      ok: false,
      reason: 'no_booking_ref_in_memo',
    });

    const res = await POST(makeRequest(validPayload, 'test-sepay-key-abc123'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(processPaymentWebhook).not.toHaveBeenCalled();
    // No `unmatched` on the verify result → nothing recordable.
    expect(recordUnmatchedPaymentEvent).not.toHaveBeenCalled();
  });

  it('records an orphan PaymentEvent when the adapter reports an unmatched transfer (Bug B)', async () => {
    // This short-circuit never reaches processPaymentWebhook, so the orphan write
    // has to happen here — otherwise a real transfer with an unusable memo leaves
    // zero DB trace and the reconcile sweeper has nothing to degrade-match.
    const adapter = getBankTransferAdapter();
    vi.mocked(adapter.verifyWebhook).mockReturnValueOnce({
      ok: false,
      reason: 'no_booking_ref_in_memo',
      unmatched: { providerTxnId: '99' },
    });

    const res = await POST(makeRequest(validPayload, 'test-sepay-key-abc123', 'Apikey'));

    expect(recordUnmatchedPaymentEvent).toHaveBeenCalledWith({
      adapter: 'bank_transfer',
      providerTxnId: '99',
      rawBody: validPayload,
      unmatchedReason: 'no_booking_ref_in_memo',
    });
    expect(processPaymentWebhook).not.toHaveBeenCalled();
    // Ack shape unchanged — SePay must still treat this delivery as final.
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
  });

  it('holds (orphan) + does NOT credit when the transfer lands in a wrong account (Issue 334)', async () => {
    const adapter = getBankTransferAdapter();
    vi.mocked(adapter.verifyWebhook).mockReturnValueOnce({
      ok: false,
      reason: 'account_mismatch',
      unmatched: { providerTxnId: '77' },
    });

    const res = await POST(makeRequest(validPayload, 'test-sepay-key-abc123', 'Apikey'));

    // Money arrived somewhere → recorded as orphan (held, never auto-credited).
    expect(recordUnmatchedPaymentEvent).toHaveBeenCalledWith({
      adapter: 'bank_transfer',
      providerTxnId: '77',
      rawBody: validPayload,
      unmatchedReason: 'account_mismatch',
    });
    // Never reaches the credit path.
    expect(processPaymentWebhook).not.toHaveBeenCalled();
    // Ack 200 so SePay stops retrying.
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
  });

  it('delegates to processPaymentWebhook on valid auth + valid payload', async () => {
    const adapter = getBankTransferAdapter();
    vi.mocked(adapter.verifyWebhook).mockReturnValueOnce({
      ok: true,
      event: {
        orderRef: 'BB-2026-abcd-ef01',
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
    // processPaymentWebhook's shared {message:'ok'} is re-emitted as SePay's ack.
    await expect(res.json()).resolves.toEqual({ success: true });
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
    // Non-2xx passes through unwrapped so SePay retries.
    await expect(res.json()).resolves.toEqual({ error: 'INVALID_SIGNATURE' });
    expect(processPaymentWebhook).toHaveBeenCalled();
  });
});
