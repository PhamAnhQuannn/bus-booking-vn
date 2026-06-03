/**
 * Gateway selector — maps an online payment method to its PaymentGateway.
 *
 * Phase 1 (PAYMENTS_STUB=true or no real PSP creds):
 *   momo    → real MoMo sandbox adapter, UNLESS PAYMENTS_STUB → stub
 *   zalopay → local stub (no real adapter until Phase 2)
 *   card    → local stub (no real adapter until Phase 2)
 *
 * Phase 2 swaps real zalopay/card adapters in here with no caller change.
 */

import { getEnv } from '@/lib/config/env';
import { getMomoAdapter } from './adapters/momo';
import { getStubAdapter } from './adapters/stub';
import type { PaymentGateway } from './gateway';

export type OnlinePaymentMethod = 'momo' | 'zalopay' | 'card';

/**
 * Resolve the gateway for an online method. `baseUrl` is required because the
 * stub adapter points the browser at the local stub-pay page.
 */
export function getGatewayFor(
  method: OnlinePaymentMethod,
  baseUrl: string
): PaymentGateway {
  const env = getEnv();

  if (method === 'momo' && !env.PAYMENTS_STUB) {
    return getMomoAdapter();
  }

  // momo (when stubbed), zalopay, card → local fake gateway
  return getStubAdapter(method, baseUrl);
}
