/**
 * #371 — vendor error strings must not re-leak the recipient the UI just masked.
 *
 * The admin failure list masks `recipient` via maskRecipient and then rendered
 * `lastError` raw one line below. Resend puts the failing address into error.message
 * (lib/notification/email.ts), so the mask was cosmetic.
 */

import { describe, it, expect } from 'vitest';
import { redactErrorText } from '../redactErrorText';

describe('redactErrorText', () => {
  it('scrubs the email address out of a realistic Resend rejection', () => {
    const out = redactErrorText(
      'Invalid `to` field. The email address buyer.name+tag@example.com is not valid.'
    );
    expect(out).not.toContain('buyer.name+tag@example.com');
    expect(out).toContain('[email]');
  });

  it('scrubs every address when a vendor lists several', () => {
    const out = redactErrorText('rejected: a@b.com, c@d.co.uk');
    expect(out).not.toMatch(/@/);
  });

  it('scrubs Vietnamese mobile numbers in their common written forms', () => {
    for (const phone of ['0912345678', '+84912345678', '84912345678', '0912 345 678', '0912-345-678']) {
      const out = redactErrorText(`eSMS rejected ${phone}: invalid subscriber`);
      expect(out, `should have scrubbed ${phone}`).toContain('[phone]');
      expect(out.replace(/\[phone\]/g, ''), `leaked ${phone}`).not.toContain(
        phone.replace(/[\s-]/g, '').slice(-9)
      );
    }
  });

  it('leaves an error with no contact detail intact — operators still need to read it', () => {
    const msg = 'Rate limit exceeded, please retry after 30s';
    expect(redactErrorText(msg)).toBe(msg);
  });

  it('does not swallow long non-phone digit runs (order ids, timestamps)', () => {
    // The bound on the phone pattern exists so a 20-digit provider reference is not
    // mistaken for a number and blanked — over-scrubbing makes errors unreadable.
    const msg = 'provider ref 4457789921334455667788 failed';
    expect(redactErrorText(msg)).toBe(msg);
  });

  it('#394: leaves a digit run whose tail is phone-shaped intact (no interior match)', () => {
    // Without the leading (?<!\d) anchor the old regex matched "00912345678" INSIDE this
    // provider ref (an interior 0-prefixed run reaching the end \b) and blanked its tail.
    // The anchor now requires the phone to START a digit run, so the ref is left readable.
    const msg = 'gateway ref REF12300912345678 declined';
    expect(redactErrorText(msg)).toBe(msg);
  });

  it('is idempotent — re-running never corrupts already-redacted text', () => {
    const once = redactErrorText('failed for a@b.com');
    expect(redactErrorText(once)).toBe(once);
  });
});
