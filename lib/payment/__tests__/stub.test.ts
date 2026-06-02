/**
 * Unit tests for the local fake-gateway stub adapter (lib/payment/stub.ts).
 *
 * Entirely in-process — no HTTP, no env. The adapter is built with an injected
 * secret via createStubAdapter so no real PSP creds are required.
 *
 * Test cases:
 *   - buildStubIpn(success) round-trips through verifyWebhook → ok, resultCode 0
 *   - buildStubIpn(fail)    round-trips through verifyWebhook → ok, resultCode 99
 *   - tampered amount → ok=false (sig_mismatch)
 *   - wrong secret  → ok=false (sig_mismatch)
 *   - missing signature → ok=false
 *   - invalid JSON  → ok=false (no throw)
 *   - deterministic transId — same order+outcome → identical transId (idempotency key)
 *   - createPayment → payUrl points at /dev/stub-pay carrying adapter/orderId/amount/redirectUrl
 */

import { describe, it, expect } from 'vitest';
import { createStubAdapter, buildStubIpn } from '../stub';

const SECRET = 'dev-stub-secret-0123456789abcdef';
const BASE_URL = 'https://example.com';

const adapter = createStubAdapter({ secretKey: SECRET, baseUrl: BASE_URL, adapter: 'zalopay' });

describe('stub adapter — verifyWebhook', () => {
  it('accepts a valid success IPN and parses resultCode 0', () => {
    const ipn = buildStubIpn({
      secretKey: SECRET,
      adapter: 'zalopay',
      orderId: 'BB-2026-abcd-1234',
      amount: 200000,
      outcome: 'success',
    });
    const result = adapter.verifyWebhook(JSON.stringify(ipn));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.orderRef).toBe('BB-2026-abcd-1234');
    expect(result.event.providerTxnId).toBe('stub_BB-2026-abcd-1234_success');
    expect(result.event.status).toBe('paid');
    expect(result.event.amount).toBe(200000);
    expect(result.event.currency).toBe('VND');
  });

  it('accepts a valid fail IPN and parses resultCode 99', () => {
    const ipn = buildStubIpn({
      secretKey: SECRET,
      adapter: 'card',
      orderId: 'BB-2026-ffff-9999',
      amount: 100000,
      outcome: 'fail',
    });
    const result = adapter.verifyWebhook(JSON.stringify(ipn));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.status).toBe('failed');
    expect(result.event.currency).toBe('VND');
    expect(result.event.providerTxnId).toBe('stub_BB-2026-ffff-9999_fail');
  });

  it('rejects a tampered amount', () => {
    const ipn = buildStubIpn({
      secretKey: SECRET,
      adapter: 'zalopay',
      orderId: 'BB-2026-abcd-1234',
      amount: 200000,
      outcome: 'success',
    });
    const tampered = { ...ipn, amount: 1 };
    const result = adapter.verifyWebhook(JSON.stringify(tampered));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('sig_mismatch');
  });

  it('rejects an IPN signed with a different secret', () => {
    const ipn = buildStubIpn({
      secretKey: 'a-totally-different-secret-value',
      adapter: 'zalopay',
      orderId: 'BB-2026-abcd-1234',
      amount: 200000,
      outcome: 'success',
    });
    const result = adapter.verifyWebhook(JSON.stringify(ipn));

    expect(result.ok).toBe(false);
  });

  it('rejects an IPN with no signature field', () => {
    const ipn = buildStubIpn({
      secretKey: SECRET,
      adapter: 'zalopay',
      orderId: 'BB-2026-abcd-1234',
      amount: 200000,
      outcome: 'success',
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { signature: _sig, ...withoutSig } = ipn;

    expect(() => adapter.verifyWebhook(JSON.stringify(withoutSig))).not.toThrow();
    const result = adapter.verifyWebhook(JSON.stringify(withoutSig));
    expect(result.ok).toBe(false);
  });

  it('returns ok=false for invalid JSON without throwing', () => {
    expect(() => adapter.verifyWebhook('not json{')).not.toThrow();
    expect(adapter.verifyWebhook('not json{').ok).toBe(false);
  });

  it('canonical round-trip: buildStubIpn → verifyWebhook maps outcome to status', () => {
    const success = adapter.verifyWebhook(
      JSON.stringify(
        buildStubIpn({
          secretKey: SECRET,
          adapter: 'zalopay',
          orderId: 'BB-2026-rrrr-0001',
          amount: 200000,
          outcome: 'success',
        })
      )
    );
    expect(success.ok).toBe(true);
    if (success.ok) expect(success.event.status).toBe('paid');

    const fail = adapter.verifyWebhook(
      JSON.stringify(
        buildStubIpn({
          secretKey: SECRET,
          adapter: 'zalopay',
          orderId: 'BB-2026-rrrr-0002',
          amount: 200000,
          outcome: 'fail',
        })
      )
    );
    expect(fail.ok).toBe(true);
    if (fail.ok) expect(fail.event.status).toBe('failed');
  });
});

describe('stub adapter — idempotency key', () => {
  it('emits a deterministic transId for the same order + outcome', () => {
    const a = buildStubIpn({
      secretKey: SECRET,
      adapter: 'zalopay',
      orderId: 'BB-2026-abcd-1234',
      amount: 200000,
      outcome: 'success',
    });
    const b = buildStubIpn({
      secretKey: SECRET,
      adapter: 'zalopay',
      orderId: 'BB-2026-abcd-1234',
      amount: 200000,
      outcome: 'success',
    });
    expect(a.transId).toBe(b.transId);
    expect(a.transId).toBe('stub_BB-2026-abcd-1234_success');
  });
});

describe('stub adapter — createPayment', () => {
  it('returns a payUrl to /dev/stub-pay carrying order params', async () => {
    const result = await adapter.createPayment({
      orderId: 'BB-2026-abcd-1234',
      amount: 200000,
      orderInfo: 'BusBookVN: Hà Nội - TP.HCM',
      ipnUrl: `${BASE_URL}/api/payments/zalopay/webhook`,
      redirectUrl: `${BASE_URL}/booking/result/token123`,
      requestId: 'req-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.externalRef).toBe('BB-2026-abcd-1234');

    const url = new URL(result.payUrl);
    expect(url.pathname).toBe('/dev/stub-pay');
    expect(url.searchParams.get('adapter')).toBe('zalopay');
    expect(url.searchParams.get('orderId')).toBe('BB-2026-abcd-1234');
    expect(url.searchParams.get('amount')).toBe('200000');
    expect(url.searchParams.get('redirectUrl')).toBe(`${BASE_URL}/booking/result/token123`);
  });
});
