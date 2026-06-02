/**
 * POST /api/payments/card/webhook — Card IPN receiver.
 *
 * Thin gateway-specific shell, parallel to the MoMo receiver. Resolves the
 * gateway via getGatewayFor('card', baseUrl) — local fake-gateway stub while
 * PAYMENTS_STUB=true, real card PSP adapter swapped in (Phase 2) with no change
 * here. Delegates all logic to the shared processPaymentWebhook.
 *
 * Native result code → canonical status mapping lives in the adapter
 * (lib/payment/stub.ts): success = STUB_SUCCESS_CODE (0) → paid,
 * fail = STUB_FAILURE_CODE (99) → failed. No pending state in the stub.
 */

export const runtime = 'nodejs';

import { type NextRequest } from 'next/server';
import { getGatewayFor } from '@/lib/payment/select';
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
  });
}

export const POST = withErrorHandler(handler);
