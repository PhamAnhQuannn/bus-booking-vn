/**
 * initiateMomoBooking — thin wrapper over the generic initiateOnlineBooking,
 * pinned to method 'momo'. Preserved for existing callers + tests; the gateway
 * injection point is forwarded so MoMo-specific fake-gateway tests still work.
 */

import {
  initiateOnlineBooking,
  type InitiateOnlineBookingResult,
} from './initiateOnlineBooking';
import { CONSENT_VERSION } from './consent';
import type { PaymentGateway } from '@/lib/payment/gateway';

export interface InitiateMomoBookingInput {
  holdId: string;
  /**
   * Absolute base URL of this deployment (e.g. https://example.com).
   * Used to build ipnUrl and redirectUrl passed to MoMo.
   */
  baseUrl: string;
  /**
   * Issue 089: consent text version the buyer accepted. Optional on this legacy
   * wrapper — defaults to the current CONSENT_VERSION when omitted.
   */
  consentVersion?: string;
  /**
   * Injectable payment gateway for testing. Defaults (inside
   * initiateOnlineBooking) to getGatewayFor('momo', baseUrl).
   */
  gateway?: PaymentGateway;
}

export type InitiateMomoBookingResult = InitiateOnlineBookingResult;

export async function initiateMomoBooking(
  input: InitiateMomoBookingInput
): Promise<InitiateMomoBookingResult> {
  return initiateOnlineBooking({
    ...input,
    method: 'momo',
    consentVersion: input.consentVersion ?? CONSENT_VERSION,
  });
}
