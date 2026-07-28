/**
 * Structural guard: bank_transfer is the ONLY payment webhook route that may exist.
 *
 * Why this test exists. `getGatewayFor()` (lib/payment/select.ts) falls through to the
 * fake gateway for any method without a real adapter — card and zalopay always, momo
 * and vnpay whenever their flags are off. The fake gateway signs and verifies with
 * STUB_PAYMENT_SECRET, whose default is a literal published in this repo. So every
 * webhook route that resolved a stub-backed gateway was an unauthenticated
 * "mark this bookingRef paid" endpoint: processWebhook resolves the booking from the
 * IPN's orderId and never checks the inbound adapter against booking.paymentMethod.
 * All four such routes (momo, zalopay, card, vnpay) plus the vnpay return route were
 * deleted; proxy.ts's RATELIMIT_EXEMPT list went with them.
 *
 * Scaffolding a new PSP route is therefore a security decision, not a routine one. If
 * you are adding a real PSP: give it real credentials, a real signature check, and
 * update this list in the same commit.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync } from 'fs';
import path from 'path';

const PAYMENTS_DIR = path.join(process.cwd(), 'app', 'api', 'payments');

/** Adapters permitted to expose an HTTP route under app/api/payments/. */
const ALLOWED_ADAPTER_ROUTES = ['bank_transfer'];

describe('payment webhook surface', () => {
  it('exposes routes for the allowed adapters only', () => {
    const dirs = readdirSync(PAYMENTS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('__'))
      .map((e) => e.name)
      .sort();

    expect(dirs).toEqual([...ALLOWED_ADAPTER_ROUTES].sort());
  });

  it('has no vnpay return route (it was a second, divergent parser of signed bytes)', () => {
    expect(existsSync(path.join(PAYMENTS_DIR, 'vnpay'))).toBe(false);
  });
});
