/**
 * Gateway selector — maps an online payment method to its PaymentGateway.
 *
 * Routing:
 *   bank_transfer → real VietQR/SePay adapter (no stub — internal QR flow)
 *   momo          → real MoMo adapter, UNLESS PAYMENTS_STUB → stub
 *   vnpay         → real VNPay adapter ONLY when VNPAY_ENABLED && !PAYMENTS_STUB;
 *                   otherwise stub (VNPAY_ENABLED is the real kill-switch)
 *   zalopay       → local stub (no real adapter until Phase 2)
 *   card          → local stub (no real adapter until Phase 2)
 *
 * Phase 2 swaps real zalopay/card adapters in here with no caller change.
 */

import { getEnv } from '@/lib/config';
import { getMomoAdapter } from './adapters/momo';
import { getVnpayAdapter } from './adapters/vnpay';
import { getBankTransferAdapter } from './adapters/bankTransfer';
import { getStubAdapter } from './adapters/stub';
import type { PaymentGateway } from './gateway';

export type OnlinePaymentMethod = 'momo' | 'zalopay' | 'card' | 'vnpay' | 'bank_transfer';

/**
 * Resolve the gateway for an online method. `baseUrl` is required because the
 * stub adapter points the browser at the local stub-pay page.
 */
export function getGatewayFor(
  method: OnlinePaymentMethod,
  baseUrl: string
): PaymentGateway {
  const env = getEnv();

  if (method === 'bank_transfer') {
    return getBankTransferAdapter();
  }

  if (method === 'momo' && !env.PAYMENTS_STUB) {
    return getMomoAdapter();
  }

  // VNPAY_ENABLED is the real runtime kill-switch: route to the real VNPay
  // adapter ONLY when explicitly enabled AND not in stub mode. Left disabled (the
  // default), vnpay falls through to the stub — so PAYMENTS_STUB=false can never
  // silently activate real VNPay pointed at sandbox-default credentials.
  if (method === 'vnpay' && env.VNPAY_ENABLED && !env.PAYMENTS_STUB) {
    return getVnpayAdapter();
  }

  // momo (when stubbed), zalopay, card, vnpay (when stubbed) → local fake gateway
  return getStubAdapter(method, baseUrl);
}
