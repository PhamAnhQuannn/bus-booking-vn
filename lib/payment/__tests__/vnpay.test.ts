/**
 * Unit tests for the VNPay payment adapter (lib/payment/adapters/vnpay.ts).
 *
 * MONEY-CRITICAL. Entirely in-process — no HTTP, no env vars. The adapter is
 * constructed with injected config via createVnpayAdapter.
 *
 * VNPay signing (public docs): HMAC-SHA512 over the alphabetically-sorted
 * canonical `vnp_Key=rawValue&...` string of all vnp_* fields EXCEPT
 * vnp_SecureHash / vnp_SecureHashType. Values are RAW in the sign string,
 * URL-encoded in the transport query string. verifyWebhook parses the transport
 * string with URLSearchParams (which URL-decodes), so signing over raw values +
 * URLSearchParams-encoding the transport body round-trips correctly.
 *
 * Test cases:
 *   verifyWebhook: valid sig → ok=true, parsed event
 *   verifyWebhook: sig_mismatch (tampered value) → ok=false
 *   verifyWebhook: missing_signature (no vnp_SecureHash) → ok=false
 *   verifyWebhook: key-order independence (deterministic)
 *   verifyWebhook: invalid_amount guard (negative amount, valid sig)
 *   classifyVnpayStatus: every success/failure/pending code + an unknown code
 *   createPayment: builds a signed payUrl whose signature re-verifies
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { createVnpayAdapter, type VnpayConfig } from '../adapters/vnpay';

const CONFIG: VnpayConfig = {
  tmnCode: 'TESTTMN01',
  hashSecret: 'testsecret0123456789abcdef0123456789ABCD',
  vnpUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: 'https://example.com/api/payments/vnpay/return',
};

const adapter = createVnpayAdapter(CONFIG);

/**
 * Build a VNPay transport body (URL-encoded query string) with a valid
 * HMAC-SHA512 vnp_SecureHash over the sorted RAW-value canonical string.
 * Mirrors the adapter's buildSignData exactly. Exported shape reused by the
 * e2e VNPay spec (issue 125) via its own copy.
 */
function signVnpayBody(
  params: Record<string, string>,
  secret: string = CONFIG.hashSecret,
): string {
  const signData = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const hash = crypto.createHmac('sha512', secret).update(signData).digest('hex');
  const query = Object.keys(params)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join('&');
  return `${query}&vnp_SecureHash=${hash}`;
}

/** A canonical successful IPN param set (vnp_Amount is ×100 → 150,000 VND). */
function baseParams(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    vnp_Amount: '15000000',
    vnp_BankCode: 'NCB',
    vnp_OrderInfo: 'Bus booking payment',
    vnp_ResponseCode: '00',
    vnp_TransactionNo: '14200001',
    vnp_TransactionStatus: '00',
    vnp_TxnRef: 'BB-2026-abcd-1234',
    ...overrides,
  };
}

describe('VNPay adapter — verifyWebhook', () => {
  it('returns ok=true with parsed event for a valid signature', () => {
    const result = adapter.verifyWebhook(signVnpayBody(baseParams()));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.event.orderRef).toBe('BB-2026-abcd-1234');
    expect(result.event.providerTxnId).toBe('14200001');
    expect(result.event.amount).toBe(150000); // ×100 divided back
    expect(result.event.currency).toBe('VND');
    expect(result.event.status).toBe('paid');
  });

  it('returns ok=false (sig_mismatch) when a signed value is tampered after signing', () => {
    const signed = signVnpayBody(baseParams());
    // Flip the amount in the transport string WITHOUT re-signing.
    const tampered = signed.replace('vnp_Amount=15000000', 'vnp_Amount=1');
    const result = adapter.verifyWebhook(tampered);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('sig_mismatch');
  });

  it('returns ok=false (missing_signature) when vnp_SecureHash is absent', () => {
    const query = Object.entries(baseParams())
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const result = adapter.verifyWebhook(query);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('missing_signature');
  });

  it('is deterministic — signature verifies regardless of param insertion order', () => {
    const reordered = signVnpayBody({
      vnp_TxnRef: 'BB-2026-abcd-1234',
      vnp_ResponseCode: '00',
      vnp_Amount: '15000000',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '14200001',
      vnp_OrderInfo: 'Bus booking payment',
      vnp_BankCode: 'NCB',
    });
    const result = adapter.verifyWebhook(reordered);
    expect(result.ok).toBe(true);
  });

  it('returns ok=false (invalid_amount) for a validly-signed negative amount', () => {
    const result = adapter.verifyWebhook(signVnpayBody(baseParams({ vnp_Amount: '-100' })));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid_amount');
  });

  it('strips vnp_SecureHashType before recomputing the signature', () => {
    // Sign the base params (which exclude SecureHash/SecureHashType), then append
    // vnp_SecureHashType to the TRANSPORT body. verifyWebhook must strip it before
    // recomputing — if the exclusion regressed, the recomputed hash would differ.
    const signed = `${signVnpayBody(baseParams())}&vnp_SecureHashType=SHA512`;
    const result = adapter.verifyWebhook(signed);
    expect(result.ok).toBe(true);
  });

  it('does not throw on malformed input', () => {
    expect(() => adapter.verifyWebhook('%%%not=a&valid')).not.toThrow();
  });
});

describe('VNPay adapter — status classification (via verifyWebhook)', () => {
  const cases: Array<[string, 'paid' | 'failed' | 'pending' | 'unknown']> = [
    ['00', 'paid'],
    ['24', 'failed'],
    ['51', 'failed'],
    ['65', 'failed'],
    ['75', 'failed'],
    ['11', 'failed'],
    ['12', 'failed'],
    ['13', 'failed'],
    ['01', 'pending'],
    ['02', 'pending'],
    ['99', 'unknown'], // unmapped code
  ];

  for (const [code, expected] of cases) {
    it(`maps vnp_TransactionStatus=${code} → ${expected}`, () => {
      // Use a non-zero amount so the invalid_amount guard never fires; the
      // status field under test is vnp_TransactionStatus (IPN-authoritative).
      const params = baseParams({ vnp_TransactionStatus: code, vnp_ResponseCode: code });
      const result = adapter.verifyWebhook(signVnpayBody(params));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.event.status).toBe(expected);
    });
  }

  it('prefers vnp_TransactionStatus over vnp_ResponseCode when they disagree', () => {
    // IPN-authoritative field wins: status=00 (paid) even though responseCode=24 (failed).
    const params = baseParams({ vnp_TransactionStatus: '00', vnp_ResponseCode: '24' });
    const result = adapter.verifyWebhook(signVnpayBody(params));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.status).toBe('paid');
  });

  it('falls back to vnp_ResponseCode when vnp_TransactionStatus is absent (return-URL flow)', () => {
    // The return-URL flow omits vnp_TransactionStatus; classification must use responseCode.
    const { vnp_TransactionStatus: _omit, ...withoutStatus } = baseParams({ vnp_ResponseCode: '24' });
    void _omit;
    const result = adapter.verifyWebhook(signVnpayBody(withoutStatus));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.status).toBe('failed');
  });
});

describe('VNPay adapter — createPayment', () => {
  it('builds a signed payUrl whose signature re-verifies', async () => {
    const result = await adapter.createPayment({
      orderId: 'BB-2026-abcd-1234',
      amount: 150000,
      orderInfo: 'Bus booking payment',
      redirectUrl: 'https://example.com/api/payments/vnpay/return',
      ipnUrl: 'https://example.com/api/payments/vnpay/webhook',
      requestId: 'req-001',
      clientIp: '203.0.113.7',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payUrl.startsWith(CONFIG.vnpUrl)).toBe(true);
    expect(result.payUrl).toContain('vnp_SecureHash=');
    expect(result.payUrl).toContain('vnp_TxnRef=BB-2026-abcd-1234');
    expect(result.payUrl).toContain(`vnp_TmnCode=${CONFIG.tmnCode}`);
    // vnp_Amount is ×100 in the URL.
    expect(result.payUrl).toContain('vnp_Amount=15000000');
    expect(result.externalRef).toBe('BB-2026-abcd-1234');

    // The query portion (after the gateway URL) must verify against the same secret.
    const query = result.payUrl.slice(CONFIG.vnpUrl.length + 1);
    const verify = adapter.verifyWebhook(query);
    expect(verify.ok).toBe(true);
    if (!verify.ok) return;
    expect(verify.event.orderRef).toBe('BB-2026-abcd-1234');
    expect(verify.event.amount).toBe(150000);
  });

  it('sends the real client IP as vnp_IpAddr (not a hardcoded default)', async () => {
    const result = await adapter.createPayment({
      orderId: 'BB-2026-abcd-1234',
      amount: 150000,
      orderInfo: 'Bus booking payment',
      redirectUrl: 'https://example.com/api/payments/vnpay/return',
      ipnUrl: 'https://example.com/api/payments/vnpay/webhook',
      requestId: 'req-002',
      clientIp: '203.0.113.7',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payUrl).toContain(`vnp_IpAddr=${encodeURIComponent('203.0.113.7')}`);
  });
});
