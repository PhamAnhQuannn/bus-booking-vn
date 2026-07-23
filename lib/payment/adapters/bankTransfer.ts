/**
 * SePay / VietQR bank transfer adapter.
 *
 * Unlike MoMo/VNPay, bank transfer has no external PSP call for createPayment —
 * it returns an internal redirect URL to the QR display page. Webhook auth is a
 * simple bearer token check (done in the route handler before calling
 * processPaymentWebhook), so verifyWebhook only parses the body and extracts
 * the bookingRef from the transfer memo.
 *
 * SePay webhook payload shape (from DS-013):
 *   { id, gateway, transactionDate, accountNumber, subAccount, transferType,
 *     transferAmount, accumulated, code, content, referenceCode, description }
 *
 * The bookingRef is extracted from `content` (transfer memo) using a
 * case-insensitive non-anchored variant of BOOKING_REF_REGEX.
 */

import type {
  PaymentGateway,
  CreatePaymentInput,
  CreatePaymentResult,
  VerifyWebhookResult,
} from '../gateway';

interface SepayWebhookPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  subAccount: string | null;
  transferType: string;
  transferAmount: number;
  accumulated: number;
  code: string | null;
  content: string;
  referenceCode: string | null;
  description: string;
}

// Non-anchored, case-insensitive variant of BOOKING_REF_REGEX for extraction from
// memo text. Source pattern: BB-YYYY-XXXX-XXXX (lowercase base36 segments).
//
// Vietnamese bank transfer memos (nội dung chuyển khoản) strip non-alphanumeric
// characters, so the canonical `BB-2026-c64f-v372` arrives as `BB2026c64fv372`.
// The separators are therefore OPTIONAL here ([-\s]?), and we capture the three
// segments to rebuild the canonical hyphenated ref for the DB lookup below.
const EXTRACT_REGEX = /BB[-\s]?(\d{4})[-\s]?([0-9a-z]{4})[-\s]?([0-9a-z]{4})/i;

function createBankTransferAdapter(): PaymentGateway {
  return {
    async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
      // Strip origin from redirectUrl — bank transfer is internal (no external PSP),
      // and the bank-transfer page rejects absolute URLs to prevent open redirects.
      let safeRedirect = input.redirectUrl;
      try {
        const parsed = new URL(input.redirectUrl);
        safeRedirect = parsed.pathname + parsed.search + parsed.hash;
      } catch {
        // Already a relative path — use as-is
      }

      const params = new URLSearchParams({
        bookingRef: input.orderId,
        amount: String(input.amount),
        redirectUrl: safeRedirect,
      });

      return {
        ok: true,
        payUrl: `/booking/bank-transfer?${params.toString()}`,
        externalRef: `bt-${input.orderId}`,
      };
    },

    verifyWebhook(rawBody: string): VerifyWebhookResult {
      let payload: SepayWebhookPayload;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return { ok: false, reason: 'invalid_json' };
      }

      if (typeof payload.transferAmount !== 'number' || payload.transferAmount <= 0) {
        return { ok: false, reason: 'invalid_amount' };
      }

      if (payload.transferType !== 'in') {
        return { ok: false, reason: 'not_inbound_transfer' };
      }

      const memo = payload.content ?? '';
      const match = EXTRACT_REGEX.exec(memo);
      if (!match) {
        return { ok: false, reason: 'no_booking_ref_in_memo' };
      }

      // Rebuild the canonical hyphenated ref from the captured segments — the memo
      // may have arrived without separators (BB2026c64fv372), but the DB stores the
      // hyphenated form (bb-2026-c64f-v372).
      const orderRef = `bb-${match[1]}-${match[2]}-${match[3]}`.toLowerCase();

      return {
        ok: true,
        event: {
          orderRef,
          providerTxnId: String(payload.id),
          amount: payload.transferAmount,
          currency: 'VND',
          status: 'paid',
        },
      };
    },
  };
}

let _adapter: PaymentGateway | null = null;

export function getBankTransferAdapter(): PaymentGateway {
  if (_adapter) return _adapter;
  _adapter = createBankTransferAdapter();
  return _adapter;
}

export function _resetBankTransferAdapter(): void {
  _adapter = null;
}
