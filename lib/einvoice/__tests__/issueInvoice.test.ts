/**
 * Unit test for issueInvoice — the thin orchestrator that delegates to the
 * selected provider. Proves it passes the request through unchanged and returns
 * the provider's result verbatim (#775).
 */

import { describe, it, expect, vi } from 'vitest';
import type { InvoiceRequest, InvoiceResult } from '../types';

const { mockIssue } = vi.hoisted(() => ({ mockIssue: vi.fn() }));
vi.mock('../misaClient', () => ({
  getEInvoiceProvider: () => ({ issueInvoice: mockIssue }),
}));

import { issueInvoice } from '../issueInvoice';

const REQ: InvoiceRequest = {
  bookingId: 'bk-1',
  operatorId: 'op-1',
  buyerName: 'Nguyen Van A',
  amount: 250_000,
  description: 'Ve xe',
};

describe('issueInvoice', () => {
  it('delegates to the provider with the same request and returns its result', async () => {
    const result: InvoiceResult = { ok: true, invoiceNumber: 'INV-1', vendorRef: 'r1' };
    mockIssue.mockResolvedValue(result);

    const out = await issueInvoice(REQ);

    expect(mockIssue).toHaveBeenCalledTimes(1);
    expect(mockIssue).toHaveBeenCalledWith(REQ);
    expect(out).toBe(result);
  });

  it('propagates a provider failure result unchanged', async () => {
    const failure: InvoiceResult = { ok: false, error: 'misa_not_configured' };
    mockIssue.mockResolvedValue(failure);
    expect(await issueInvoice(REQ)).toEqual(failure);
  });
});
