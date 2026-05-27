/**
 * POST /api/payments/card/webhook — Card IPN receiver.
 *
 * Thin gateway-specific shell, parallel to the MoMo receiver. Resolves the
 * gateway via getGatewayFor('card', baseUrl) — local fake-gateway stub while
 * PAYMENTS_STUB=true, real card PSP adapter swapped in (Phase 2) with no change
 * here. Delegates all logic to the shared processPaymentWebhook.
 *
 * Stub resultCodes: success = STUB_SUCCESS_CODE (0), fail = STUB_FAILURE_CODE (99).
 * No pending state in the stub.
 */

export const runtime = 'nodejs';

import { type NextRequest } from 'next/server';
import { getGatewayFor } from '@/lib/payment/select';
import { STUB_FAILURE_CODE } from '@/lib/payment/stub';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { processPaymentWebhook } from '@/lib/payment/processWebhook';

async function handler(req: NextRequest): Promise<Response> {
  const rawBody = await req.text();
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  const baseUrl = host ? `${proto}://${host}` : '';

  return processPaymentWebhook({
    rawBody,
    gateway: getGatewayFor('card', baseUrl),
    adapter: 'card',
    proto,
    host,
    failureResultCodes: new Set([STUB_FAILURE_CODE]),
    pendingResultCodes: new Set(),
  });
}

export const POST = withErrorHandler(handler);
