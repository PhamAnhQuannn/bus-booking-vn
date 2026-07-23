import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getBankTransferAdapter, _resetBankTransferAdapter } from '../adapters/bankTransfer';
import { BOOKING_REF_REGEX, generateBookingRef } from '@/lib/booking/bookingRef';

vi.mock('@/lib/config', () => ({
  getEnv: () => ({
    VIETQR_BANK_BIN: '970405',
    VIETQR_ACCOUNT_NUMBER: '3516205005863',
    VIETQR_ACCOUNT_NAME: 'BUS BOOK VN',
    VIETQR_TEMPLATE: 'compact2',
  }),
}));

beforeEach(() => {
  _resetBankTransferAdapter();
});

const adapter = getBankTransferAdapter();

describe('bankTransfer adapter — createPayment', () => {
  it('returns internal redirect URL with correct params', async () => {
    const result = await adapter.createPayment({
      orderId: 'BB-2026-abcd-ef01',
      amount: 150000,
      orderInfo: 'Bus ticket',
      ipnUrl: 'https://example.com/api/payments/bank_transfer/webhook',
      redirectUrl: '/booking/confirmation/tok123',
      requestId: 'req-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.externalRef).toBe('bt-BB-2026-abcd-ef01');
    expect(result.payUrl).toContain('/booking/bank-transfer?');
    expect(result.payUrl).toContain('bookingRef=BB-2026-abcd-ef01');
    expect(result.payUrl).toContain('amount=150000');
    expect(result.payUrl).not.toContain('bankBin=');
    expect(result.payUrl).not.toContain('accountNumber=');
  });

  it('strips origin from absolute redirectUrl (#261)', async () => {
    const result = await adapter.createPayment({
      orderId: 'BB-2026-abcd-ef01',
      amount: 150000,
      orderInfo: 'Bus ticket',
      ipnUrl: 'https://example.com/api/payments/bank_transfer/webhook',
      redirectUrl: 'https://example.com/booking/result/tok123',
      requestId: 'req-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const url = new URL(result.payUrl, 'http://localhost');
    const redirect = url.searchParams.get('redirectUrl');
    expect(redirect).toBe('/booking/result/tok123');
    expect(redirect).not.toContain('https://');
  });

  it('preserves relative redirectUrl as-is', async () => {
    const result = await adapter.createPayment({
      orderId: 'BB-2026-abcd-ef01',
      amount: 150000,
      orderInfo: 'Bus ticket',
      ipnUrl: 'https://example.com/api/payments/bank_transfer/webhook',
      redirectUrl: '/booking/result/tok123',
      requestId: 'req-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const url = new URL(result.payUrl, 'http://localhost');
    expect(url.searchParams.get('redirectUrl')).toBe('/booking/result/tok123');
  });
});

describe('bankTransfer adapter — verifyWebhook', () => {
  const validPayload = {
    id: 12345,
    gateway: 'Agribank',
    transactionDate: '2026-06-24 10:30:00',
    accountNumber: '3516205005863',
    subAccount: null,
    transferType: 'in',
    transferAmount: 150000,
    accumulated: 500000,
    code: null,
    content: 'Thanh toan BB-2026-abcd-ef01 xe khach',
    referenceCode: null,
    description: 'Bank transfer',
  };

  it('returns ok=true with parsed event for valid inbound transfer', () => {
    const result = adapter.verifyWebhook(JSON.stringify(validPayload));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.event.orderRef).toBe('BB-2026-abcd-ef01');
    expect(result.event.providerTxnId).toBe('12345');
    expect(result.event.amount).toBe(150000);
    expect(result.event.currency).toBe('VND');
    expect(result.event.status).toBe('paid');
  });

  it('normalises segment case but keeps the canonical uppercase BB- prefix', () => {
    const payload = { ...validPayload, content: 'Pay BB-2026-AbCd-EfGh ticket' };
    const result = adapter.verifyWebhook(JSON.stringify(payload));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Segments lowercased to match stored base36; `BB-` prefix preserved (the DB
    // column is case-sensitive — a lowercase `bb-` would never findUnique-match).
    expect(result.event.orderRef).toBe('BB-2026-abcd-efgh');
  });

  it('extracts bookingRef when the VN bank strips the hyphens from the memo', () => {
    // Real prod memo: VietQR addInfo `BB-2026-c64f-v372` arrived as `BB2026c64fv372`
    // (VN transfer memos drop non-alphanumeric chars). Must still match + rebuild
    // the canonical hyphenated ref for the DB lookup.
    const payload = { ...validPayload, content: 'BB2026c64fv372 CKN 458949' };
    const result = adapter.verifyWebhook(JSON.stringify(payload));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.orderRef).toBe('BB-2026-c64f-v372');
  });

  it('extracts bookingRef when the memo uses spaces as separators', () => {
    const payload = { ...validPayload, content: 'Thanh toan BB 2026 abcd ef01' };
    const result = adapter.verifyWebhook(JSON.stringify(payload));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.orderRef).toBe('BB-2026-abcd-ef01');
  });

  it('reconstructs the EXACT ref generateBookingRef stores (case + hyphens) so findUnique matches', () => {
    // Regression guard for the case-mismatch bug: a real generated ref has an
    // uppercase `BB-` prefix; the bank strips the hyphens in the memo; the adapter
    // must rebuild the exact stored ref, else processWebhook's findUnique misses and
    // the booking silently never confirms.
    const realRef = generateBookingRef(); // BB-YYYY-xxxx-yyyy
    const strippedMemo = realRef.replace(/-/g, ''); // as the VN bank delivers it
    const payload = { ...validPayload, content: `${strippedMemo} CKN 123456` };
    const result = adapter.verifyWebhook(JSON.stringify(payload));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.orderRef).toBe(realRef);
    expect(BOOKING_REF_REGEX.test(result.event.orderRef)).toBe(true);
  });

  it('returns invalid_json for non-JSON body', () => {
    const result = adapter.verifyWebhook('not json');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid_json');
  });

  it('returns invalid_amount for zero amount', () => {
    const payload = { ...validPayload, transferAmount: 0 };
    const result = adapter.verifyWebhook(JSON.stringify(payload));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid_amount');
  });

  it('returns invalid_amount for negative amount', () => {
    const payload = { ...validPayload, transferAmount: -100 };
    const result = adapter.verifyWebhook(JSON.stringify(payload));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid_amount');
  });

  it('returns not_inbound_transfer for outbound transfer', () => {
    const payload = { ...validPayload, transferType: 'out' };
    const result = adapter.verifyWebhook(JSON.stringify(payload));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('not_inbound_transfer');
  });

  it('returns no_booking_ref_in_memo when memo lacks booking ref', () => {
    const payload = { ...validPayload, content: 'random transfer note' };
    const result = adapter.verifyWebhook(JSON.stringify(payload));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('no_booking_ref_in_memo');
  });

  it('returns no_booking_ref_in_memo when content is empty', () => {
    const payload = { ...validPayload, content: '' };
    const result = adapter.verifyWebhook(JSON.stringify(payload));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('no_booking_ref_in_memo');
  });

  it('returns invalid_amount when transferAmount is not a number', () => {
    const payload = { ...validPayload, transferAmount: 'abc' };
    const result = adapter.verifyWebhook(JSON.stringify(payload));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid_amount');
  });
});
