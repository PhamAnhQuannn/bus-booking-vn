/**
 * Issue 089 — checkout consent capture constants.
 *
 * Single source of truth for the consent text version + the VN copy shown at
 * checkout (ReviewClient) and gated at booking-initiate. Two consents are
 * captured per booking, persisted as ConsentRecord rows in the same transaction
 * that creates the Booking (lib/db/bookingRepo.ts):
 *
 *   - 'no_refund'   — the buyer accepts the no-refund policy for online-paid tickets
 *   - 'pii_storage' — the buyer accepts storage of their PII for booking + contact
 *
 * The version string is the ConsentRecord.version stamped on each row, and the
 * initiate gate requires the client to echo this exact version (so a stale client
 * showing old copy can't silently record consent against new text).
 */

/** Current consent text version. Bump when the CONSENT_TEXT copy changes. */
export const CONSENT_VERSION = '2026-06-01';

/** Documented ConsentRecord.consentType union. */
export const CONSENT_TYPES = {
  noRefund: 'no_refund',
  piiStorage: 'pii_storage',
} as const;

export type ConsentType = (typeof CONSENT_TYPES)[keyof typeof CONSENT_TYPES];

/** VN consent copy shown at checkout. Keyed by the camelCase client field name. */
export const CONSENT_TEXT = {
  noRefund:
    'Tôi đồng ý KHÔNG hoàn tiền nếu tôi hủy hoặc không lên xe với vé đã thanh toán online.',
  piiStorage:
    'Tôi đồng ý cho nền tảng lưu trữ thông tin cá nhân (tên, số điện thoại, email) để xử lý đặt vé và liên hệ.',
} as const;
