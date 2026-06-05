/**
 * Unit tests for MoMo payment adapter (lib/payment/momo.ts).
 *
 * Tests are entirely in-process — no HTTP calls made. The adapter is
 * instantiated with injected config so no real env vars are required.
 *
 * Test cases:
 *   - verifyWebhook: valid sig → ok=true with correct parsed payload
 *   - verifyWebhook: tampered amount → ok=false
 *   - verifyWebhook: key order doesn't affect result (deterministic)
 *   - verifyWebhook: short signature → ok=false (no throw)
 *   - verifyWebhook: missing signature field → ok=false (no throw)
 *   - verifyWebhook: invalid JSON → ok=false (no throw)
 */

import { describe, it, expect } from 'vitest';
import { createMomoAdapter } from '../adapters/momo';
import sampleIpn from './fixtures/momo-ipn-sample.json';

const SANDBOX_CONFIG = {
  partnerCode: 'MOMOBKUN20180529',
  accessKey: 'klm05TvNBzhg7h7j',
  secretKey: 'at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa',
  endpoint: 'https://test-payment.momo.vn/v2/gateway/api/create',
};

const adapter = createMomoAdapter(SANDBOX_CONFIG);

describe('MoMo adapter — verifyWebhook', () => {
  it('returns ok=true with parsed payload for a valid IPN signature', () => {
    const rawBody = JSON.stringify(sampleIpn);
    const result = adapter.verifyWebhook(rawBody);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.event.orderRef).toBe('BB-2026-abcd-1234');
    expect(result.event.providerTxnId).toBe(String(sampleIpn.transId));
    expect(result.event.status).toBe('paid');
    expect(result.event.amount).toBe(150000);
    expect(result.event.currency).toBe('VND');
  });

  it('returns ok=false when amount is tampered', () => {
    const tampered = { ...sampleIpn, amount: 1 };
    const rawBody = JSON.stringify(tampered);
    const result = adapter.verifyWebhook(rawBody);

    expect(result.ok).toBe(false);
  });

  it('is deterministic regardless of JSON key order in body', () => {
    // Reorder keys in a different sequence — should not affect sig verification
    const reordered = {
      signature: sampleIpn.signature,
      transId: sampleIpn.transId,
      partnerCode: sampleIpn.partnerCode,
      amount: sampleIpn.amount,
      orderId: sampleIpn.orderId,
      requestId: sampleIpn.requestId,
      orderInfo: sampleIpn.orderInfo,
      orderType: sampleIpn.orderType,
      resultCode: sampleIpn.resultCode,
      message: sampleIpn.message,
      payType: sampleIpn.payType,
      responseTime: sampleIpn.responseTime,
      extraData: sampleIpn.extraData,
    };
    const rawBody = JSON.stringify(reordered);
    const result = adapter.verifyWebhook(rawBody);

    expect(result.ok).toBe(true);
  });

  it('returns ok=false for a short signature without throwing', () => {
    const short = { ...sampleIpn, signature: 'abcd' };
    const rawBody = JSON.stringify(short);

    expect(() => adapter.verifyWebhook(rawBody)).not.toThrow();
    const result = adapter.verifyWebhook(rawBody);
    expect(result.ok).toBe(false);
  });

  it('returns ok=false when signature field is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { signature: _sig, ...withoutSig } = sampleIpn;
    const rawBody = JSON.stringify(withoutSig);

    expect(() => adapter.verifyWebhook(rawBody)).not.toThrow();
    const result = adapter.verifyWebhook(rawBody);
    expect(result.ok).toBe(false);
  });

  it('returns ok=false for invalid JSON without throwing', () => {
    expect(() => adapter.verifyWebhook('not valid json{')).not.toThrow();
    const result = adapter.verifyWebhook('not valid json{');
    expect(result.ok).toBe(false);
  });
});

describe('MoMo adapter — createPayment', () => {
  it('makes an HTTP POST to the endpoint and returns payUrl on success', async () => {
    // We test the request shape by injecting a fake fetch. The real endpoint
    // is not called in unit tests.
    const capturedRequests: Array<{ url: string; body: unknown }> = [];

    const fakeGatewayResponse = {
      resultCode: 0,
      message: 'Success',
      payUrl: 'https://payment.momo.vn/pay/app?idk=TEST123',
      requestId: 'req-create-001',
      orderId: 'BB-2026-abcd-1234',
    };

    const fakeFetch = async (url: string, opts: RequestInit) => {
      capturedRequests.push({ url, body: JSON.parse(opts.body as string) });
      return {
        ok: true,
        json: async () => fakeGatewayResponse,
      } as Response;
    };

    const adapterWithFetch = createMomoAdapter(SANDBOX_CONFIG, fakeFetch as typeof fetch);

    const result = await adapterWithFetch.createPayment({
      orderId: 'BB-2026-abcd-1234',
      amount: 150000,
      orderInfo: 'Bus booking payment',
      ipnUrl: 'https://example.com/api/payments/momo/webhook',
      redirectUrl: 'https://example.com/booking/result/token123',
      requestId: 'req-create-001',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payUrl).toBe('https://payment.momo.vn/pay/app?idk=TEST123');
    expect(result.externalRef).toBe('BB-2026-abcd-1234');

    // Verify request was made to the correct endpoint
    expect(capturedRequests.length).toBe(1);
    expect(capturedRequests[0].url).toBe(SANDBOX_CONFIG.endpoint);

    // Verify signature was included in the request body
    const reqBody = capturedRequests[0].body as Record<string, unknown>;
    expect(typeof reqBody.signature).toBe('string');
    expect(reqBody.orderId).toBe('BB-2026-abcd-1234');
    expect(reqBody.amount).toBe(150000);
    expect(reqBody.partnerCode).toBe(SANDBOX_CONFIG.partnerCode);
  });

  it('returns ok=false when gateway responds with non-zero resultCode', async () => {
    const fakeFetch = async () => ({
      ok: true,
      json: async () => ({
        resultCode: 1001,
        message: 'Error',
      }),
    }) as Response;

    const adapterWithFetch = createMomoAdapter(SANDBOX_CONFIG, fakeFetch as typeof fetch);

    const result = await adapterWithFetch.createPayment({
      orderId: 'BB-2026-xxxx-0001',
      amount: 100000,
      orderInfo: 'test',
      ipnUrl: 'https://example.com/api/payments/momo/webhook',
      redirectUrl: 'https://example.com/booking/result/x',
      requestId: 'req-err-001',
    });

    expect(result.ok).toBe(false);
  });
});
