/**
 * #843: the PDF ticket carries the support email + absolute refund-policy and
 * complaints links. Walks the TicketDocument element tree (no real react-pdf render —
 * the smoke test in ticketPdf.test.ts covers that) and collects text + Link srcs.
 */

import { describe, it, expect } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { TicketDocument } from '../ticketPdf';
import type { CustomerBookingDetail } from '../getCustomerBookingDetail';
import { SUPPORT_EMAIL, REFUND_POLICY_PATH, COMPLAINTS_PATH } from '@/lib/core/supportLinks';

const booking: CustomerBookingDetail = {
  id: 'bk-1',
  bookingRef: 'BB-2026-abcd-efgh',
  buyerName: 'Nguyen Van A',
  buyerPhone: '0901234567',
  ticketCount: 2,
  totalVnd: 300000,
  paymentMethod: 'momo',
  status: 'paid',
  createdAt: '2026-05-02T01:00:00.000Z',
  route: { origin: 'Hanoi', destination: 'Hue' },
  departureAt: '2026-06-10T22:00:00.000Z',
  busLicensePlate: '29B-12345',
  operator: { legalName: 'Test Bus Co', contactPhone: '+8490xxxxxx9' },
  boardingPoint: null,
  boardingTime: null,
};

function collect(node: ReactNode, texts: string[], srcs: string[]): void {
  if (node == null || typeof node === 'boolean') return;
  if (typeof node === 'string' || typeof node === 'number') {
    texts.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => collect(n, texts, srcs));
    return;
  }
  if (isValidElement(node)) {
    const props = node.props as { src?: unknown; children?: ReactNode };
    if (typeof props.src === 'string') srcs.push(props.src);
    collect(props.children, texts, srcs);
  }
}

describe('TicketDocument support links (#843)', () => {
  it('renders support email + absolute policy/complaints links', () => {
    const texts: string[] = [];
    const srcs: string[] = [];
    collect(TicketDocument({ booking, token: 'tok' }), texts, srcs);
    const all = texts.join('');

    expect(srcs).toContain(`mailto:${SUPPORT_EMAIL}`);
    expect(srcs).toContain(`https://lenxevn.com${REFUND_POLICY_PATH}`);
    expect(srcs).toContain(`https://lenxevn.com${COMPLAINTS_PATH}`);
    expect(all).toContain(SUPPORT_EMAIL);
    expect(all).toContain('Chính sách hủy vé & hoàn tiền');
    expect(all).toContain('Khiếu nại');
  });
});
