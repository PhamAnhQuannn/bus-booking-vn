/**
 * Unit tests for the email channel stub (Issue 058, step C).
 *
 * The real email provider is deferred (project memory: payment-deferral-strategy)
 * — until then sendEmail is a deterministic no-network stub mirroring esms.ts:
 * always ok:true with a stub externalRef, never throws.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { sendEmail, renderEmailSubject } from '../email';

describe('sendEmail (stub)', () => {
  it('deterministically succeeds with a stub email externalRef', async () => {
    const res = await sendEmail({
      to: 'buyer@example.com',
      template: 'customerBookingPaid',
      payload: 'rendered body',
    });
    expect(res.ok).toBe(true);
    expect(res.externalRef).toMatch(/^stub_email_/);
  });

  it('accepts a structured payload as well as a string', async () => {
    const res = await sendEmail({
      to: 'op@example.com',
      template: 'operatorNewBooking',
      payload: { ticketCount: 2, route: 'A - B' },
    });
    expect(res.ok).toBe(true);
    expect(res.externalRef).toMatch(/^stub_email_/);
  });

  it('never throws (provider-failure surfaces as ok:false, not an exception)', async () => {
    // The stub path cannot fail; this asserts the call resolves rather than rejects.
    await expect(
      sendEmail({ to: 'x@y.z', template: 'unknown_template', payload: 'b' })
    ).resolves.toMatchObject({ ok: true });
  });

  it('renderEmailSubject maps known templates and falls back generically', () => {
    expect(renderEmailSubject('customerBookingPaid')).toContain('BusBookVN');
    expect(renderEmailSubject('totally_unknown')).toBe('BusBookVN');
  });
});
