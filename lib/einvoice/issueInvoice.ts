/**
 * Issue an e-invoice for a booking.
 *
 * This is the high-level orchestrator: compose an InvoiceRequest, call the
 * provider, return the result. DB persistence (EInvoice model + Booking.einvoiceRef)
 * is handled by the caller — the EInvoice schema lands in a separate migration
 * (PR 2, #75) and this module must work independently.
 */

import { getEInvoiceProvider } from './misaClient';
import type { InvoiceRequest, InvoiceResult } from './types';

export async function issueInvoice(req: InvoiceRequest): Promise<InvoiceResult> {
  const provider = getEInvoiceProvider();
  return provider.issueInvoice(req);
}
