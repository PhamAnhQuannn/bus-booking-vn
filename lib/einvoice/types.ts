export interface InvoiceRequest {
  bookingId: string;
  operatorId: string;
  buyerName: string;
  buyerEmail?: string;
  buyerTaxCode?: string;
  amount: number;
  description: string;
}

export interface InvoiceResult {
  ok: boolean;
  invoiceNumber?: string;
  vendorRef?: string;
  error?: string;
}

export interface EInvoiceProvider {
  issueInvoice(req: InvoiceRequest): Promise<InvoiceResult>;
}
