/**
 * MISA meInvoice REST client.
 *
 * EINVOICE_ENABLED=stub (default) → log + return fake invoice number (no network).
 * EINVOICE_ENABLED=misa          → call MISA meInvoice API (Circular 78/2021 compliant).
 *
 * The stub/real branch mirrors the PAYMENTS_STUB / NOTIFY_STUB pattern: the seam
 * ships now, real MISA integration activates when API credentials are provisioned.
 */

import { logger } from '@/lib/logger';
import type { EInvoiceProvider, InvoiceRequest, InvoiceResult } from './types';

function getMisaConfig() {
  return {
    apiUrl: process.env.MISA_API_URL ?? '',
    apiKey: process.env.MISA_API_KEY ?? '',
    companyCode: process.env.MISA_COMPANY_CODE ?? '',
    templateCode: process.env.MISA_TEMPLATE_CODE ?? '',
  };
}

class MisaStubProvider implements EInvoiceProvider {
  async issueInvoice(req: InvoiceRequest): Promise<InvoiceResult> {
    const invoiceNumber = `STUB-${Date.now().toString(36).toUpperCase()}`;
    logger.info(
      { bookingId: req.bookingId, invoiceNumber, amount: req.amount },
      'einvoice.stub.issued',
    );
    return { ok: true, invoiceNumber, vendorRef: `stub_${req.bookingId}` };
  }
}

class MisaRealProvider implements EInvoiceProvider {
  async issueInvoice(req: InvoiceRequest): Promise<InvoiceResult> {
    const cfg = getMisaConfig();
    if (!cfg.apiUrl || !cfg.apiKey) {
      return { ok: false, error: 'misa_not_configured' };
    }

    try {
      const body = {
        InvoiceTypeCode: cfg.templateCode,
        BuyerLegalName: req.buyerName,
        BuyerTaxCode: req.buyerTaxCode ?? '',
        BuyerEmail: req.buyerEmail ?? '',
        TotalAmount: req.amount,
        Description: req.description,
        RefNo: req.bookingId,
      };

      const res = await fetch(`${cfg.apiUrl}/api/v1/einvoice/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': cfg.apiKey,
          'X-Company-Code': cfg.companyCode,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        logger.error({ status: res.status, body: text }, 'einvoice.misa.http-error');
        return { ok: false, error: `misa_http_${res.status}` };
      }

      const data = (await res.json()) as { InvoiceNo?: string; RefId?: string };
      return {
        ok: true,
        invoiceNumber: data.InvoiceNo,
        vendorRef: data.RefId,
      };
    } catch (err) {
      logger.error({ err }, 'einvoice.misa.exception');
      return { ok: false, error: 'misa_exception' };
    }
  }
}

let _provider: EInvoiceProvider | null = null;

export function getEInvoiceProvider(): EInvoiceProvider {
  if (_provider) return _provider;
  const mode = process.env.EINVOICE_ENABLED ?? 'stub';
  _provider = mode === 'misa' ? new MisaRealProvider() : new MisaStubProvider();
  return _provider;
}

export function _resetEInvoiceProvider(): void {
  _provider = null;
}
