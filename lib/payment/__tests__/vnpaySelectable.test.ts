/**
 * Unit tests for isVnpaySelectable() — the single gate deciding whether a customer
 * may choose VNPay.
 *
 * The case that matters is VNPAY_ENABLED=true. That flag used to make vnpay
 * selectable, and flipping it is the documented next step for the VNPay rollout —
 * but VNPay's webhook and return routes are now deleted, so a real VNPay payment
 * would complete at the PSP with no route left to confirm the booking. These tests
 * pin the rejection: they FAIL against the previous
 * `PAYMENTS_STUB || VNPAY_ENABLED` gate, which is exactly what makes them worth
 * having.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// Deep import: _resetEnvCache is a test-only internal and deliberately not on the
// config barrel (CLAUDE.md 092b — tests are boundary-exempt).
import { _resetEnvCache } from '@/lib/config/env';
import { isVnpaySelectable } from '../vnpaySelectable';

// Self-sufficient base so parsing does not depend on the ambient env. The SePay
// pair is required by superRefine whenever PAYMENTS_STUB=false (bank transfer is
// the live rail), and VIETQR_ACCOUNT_NUMBER must differ from the schema default.
const BASE = {
  HOLD_SECRET: 'a'.repeat(64), // must be a hex string
  STORAGE_STUB: 'true',
  NOTIFY_STUB: 'true',
  SEPAY_API_KEY: 'test-sepay-key',
  VIETQR_ACCOUNT_NUMBER: '999888777666',
};

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  _resetEnvCache();
});

afterEach(() => {
  process.env = savedEnv;
  _resetEnvCache();
});

/** Replace process.env wholesale so leftover ambient vars cannot leak in. */
function setEnv(overrides: Record<string, string>): void {
  // Cast through unknown: ProcessEnv requires NODE_ENV, which each caller supplies.
  process.env = { ...BASE, ...overrides } as unknown as NodeJS.ProcessEnv;
  _resetEnvCache();
}

describe('isVnpaySelectable', () => {
  it('is true off-production with the stub on — the stub completes in-process', () => {
    setEnv({ NODE_ENV: 'development', PAYMENTS_STUB: 'true' });
    expect(isVnpaySelectable()).toBe(true);
  });

  it('is FALSE when VNPAY_ENABLED is on with FULL real credentials', () => {
    // The regression this file exists for, and deliberately posed at its strongest:
    // every credential a real rollout would set is present and passes superRefine.
    // vnpay is still refused, because the blocker is the deleted callback surface,
    // not missing config. Real VNPay + no callback routes = the customer pays and
    // the app never learns; no PaymentEvent row is written, so even the reconcile
    // sweeper has nothing to recover from.
    setEnv({
      NODE_ENV: 'development',
      PAYMENTS_STUB: 'false',
      VNPAY_ENABLED: 'true',
      VNPAY_HASH_SECRET: 'a-real-looking-vnpay-hash-secret-value',
      VNPAY_TMN_CODE: 'REALTMN1',
      VNPAY_RETURN_URL: 'https://lenxevn.com/api/payments/vnpay/return',
    });
    expect(isVnpaySelectable()).toBe(false);
  });

  it('is FALSE on a production deployment even with the stub on', () => {
    // /dev/stub-pay — the only surviving way to complete a vnpay payment — 404s on
    // production, so offering the method there would strand the booking.
    setEnv({
      NODE_ENV: 'production',
      PAYMENTS_STUB: 'true',
      // SEC-DEV-STUB-PROD-SAFETY (#559): a real prod boot requires STORAGE_STUB=false + S3 creds.
      STORAGE_STUB: 'false',
      STORAGE_BUCKET: 'b',
      STORAGE_REGION: 'r',
      STORAGE_ENDPOINT: 'https://r2',
      STORAGE_ACCESS_KEY: 'ak',
      STORAGE_SECRET_KEY: 'sk',
      // The full NODE_ENV=production superRefine set (lib/config/env.ts). Kept
      // explicit rather than trimmed to the ones that happen to fail first — the
      // point of the test is that a REAL production boot still hides vnpay.
      JWT_SECRET: 'j'.repeat(32),
      JWT_OPERATOR_SECRET: 'o'.repeat(32),
      JWT_ADMIN_SECRET: 'd'.repeat(32),
      REFRESH_TOKEN_SECRET_CUSTOMER: 'r'.repeat(32),
      REFRESH_TOKEN_SECRET_OPERATOR: 's'.repeat(32),
      REFRESH_TOKEN_SECRET_ADMIN: 'u'.repeat(32),
      TOTP_ENCRYPTION_KEY: 'e'.repeat(64),
      BANK_ENCRYPTION_KEY: 'b'.repeat(64),
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      CRON_SECRET: 'c'.repeat(32),
      TICKET_SECRET: 't'.repeat(32),
    });
    expect(isVnpaySelectable()).toBe(false);
  });

  it('is false with both flags off', () => {
    setEnv({ NODE_ENV: 'development', PAYMENTS_STUB: 'false' });
    expect(isVnpaySelectable()).toBe(false);
  });
});
