/**
 * Unit tests for the MISA e-invoice client seam (#775).
 *
 * lib/einvoice had zero tests. This is a money + legal path (Circular 78/2021
 * e-invoicing), so both the stub branch and every real-provider outcome are
 * pinned here with a mocked fetch — no network, runs in the normal unit suite.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { InvoiceRequest } from '../types';

// getEnv drives provider selection + MISA config; mock it per test.
const { mockGetEnv } = vi.hoisted(() => ({ mockGetEnv: vi.fn() }));
vi.mock('@/lib/core/config', () => ({ getEnv: mockGetEnv }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { getEInvoiceProvider, _resetEInvoiceProvider } from '../misaClient';

const REQ: InvoiceRequest = {
  bookingId: 'bk-1',
  operatorId: 'op-1',
  buyerName: 'Nguyen Van A',
  buyerEmail: 'a@example.com',
  buyerTaxCode: '0101234567',
  amount: 250_000,
  description: 'Ve xe Ha Noi - Sa Pa',
};

const MISA_ENV = {
  EINVOICE_ENABLED: 'misa',
  MISA_API_URL: 'https://misa.test',
  MISA_API_KEY: 'key-123',
  MISA_COMPANY_CODE: 'CO-1',
  MISA_TEMPLATE_CODE: 'TPL-1',
};

function fetchResponse(init: { ok: boolean; status: number; json?: unknown; text?: string }) {
  return {
    ok: init.ok,
    status: init.status,
    json: async () => init.json,
    text: async () => init.text ?? '',
  } as Response;
}

beforeEach(() => {
  _resetEInvoiceProvider();
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe('getEInvoiceProvider — selection + memoization', () => {
  it('defaults to the stub provider when EINVOICE_ENABLED=stub', async () => {
    mockGetEnv.mockReturnValue({ EINVOICE_ENABLED: 'stub' });
    const res = await getEInvoiceProvider().issueInvoice(REQ);
    expect(res.ok).toBe(true);
    expect(res.invoiceNumber).toMatch(/^STUB-/);
    expect(res.vendorRef).toBe('stub_bk-1');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('memoizes the provider and _resetEInvoiceProvider clears it', () => {
    mockGetEnv.mockReturnValue({ EINVOICE_ENABLED: 'stub' });
    const a = getEInvoiceProvider();
    expect(getEInvoiceProvider()).toBe(a); // same instance
    _resetEInvoiceProvider();
    mockGetEnv.mockReturnValue(MISA_ENV);
    expect(getEInvoiceProvider()).not.toBe(a); // rebuilt as real provider
  });
});

describe('MisaRealProvider.issueInvoice', () => {
  it('returns misa_not_configured when apiUrl/apiKey are missing (no fetch)', async () => {
    mockGetEnv.mockReturnValue({ EINVOICE_ENABLED: 'misa' }); // no MISA_* creds
    const res = await getEInvoiceProvider().issueInvoice(REQ);
    expect(res).toEqual({ ok: false, error: 'misa_not_configured' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('maps a 200 response InvoiceNo/RefId → invoiceNumber/vendorRef and pins the request shape', async () => {
    mockGetEnv.mockReturnValue(MISA_ENV);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      fetchResponse({ ok: true, status: 200, json: { InvoiceNo: 'INV-1', RefId: 'ref-9' } }),
    );

    const res = await getEInvoiceProvider().issueInvoice(REQ);
    expect(res).toEqual({ ok: true, invoiceNumber: 'INV-1', vendorRef: 'ref-9' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://misa.test/api/v1/einvoice/create');
    expect(opts.method).toBe('POST');
    expect(opts.headers['X-API-Key']).toBe('key-123');
    expect(opts.headers['X-Company-Code']).toBe('CO-1');
    expect(JSON.parse(opts.body)).toEqual({
      InvoiceTypeCode: 'TPL-1',
      BuyerLegalName: 'Nguyen Van A',
      BuyerTaxCode: '0101234567',
      BuyerEmail: 'a@example.com',
      TotalAmount: 250_000,
      Description: 'Ve xe Ha Noi - Sa Pa',
      RefNo: 'bk-1',
    });
  });

  it('sends empty strings for optional buyer fields when absent', async () => {
    mockGetEnv.mockReturnValue(MISA_ENV);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      fetchResponse({ ok: true, status: 200, json: { InvoiceNo: 'INV-2', RefId: 'r2' } }),
    );
    const minimal: InvoiceRequest = {
      bookingId: 'bk-2',
      operatorId: 'op-1',
      buyerName: 'Le Thi B',
      amount: 100_000,
      description: 'Ve xe',
    };
    await getEInvoiceProvider().issueInvoice(minimal);
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.BuyerTaxCode).toBe('');
    expect(body.BuyerEmail).toBe('');
  });

  it('returns misa_http_<status> on a non-ok response', async () => {
    mockGetEnv.mockReturnValue(MISA_ENV);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      fetchResponse({ ok: false, status: 500, text: 'upstream boom' }),
    );
    const res = await getEInvoiceProvider().issueInvoice(REQ);
    expect(res).toEqual({ ok: false, error: 'misa_http_500' });
  });

  it('returns misa_exception when fetch throws', async () => {
    mockGetEnv.mockReturnValue(MISA_ENV);
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
    const res = await getEInvoiceProvider().issueInvoice(REQ);
    expect(res).toEqual({ ok: false, error: 'misa_exception' });
  });

  it('returns misa_exception on request timeout (AbortError)', async () => {
    mockGetEnv.mockReturnValue(MISA_ENV);
    const abort = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(abort);
    const res = await getEInvoiceProvider().issueInvoice(REQ);
    expect(res).toEqual({ ok: false, error: 'misa_exception' });
  });
});
