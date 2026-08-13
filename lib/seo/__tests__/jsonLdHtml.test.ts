/**
 * SEC-XSS-JSONLD (#557) — jsonLdHtml must neutralize a `</script>` breakout so operator
 * self-service free-text (route names, legalName) embedded in inline JSON-LD cannot execute.
 */

import { describe, it, expect } from 'vitest';
import { jsonLdHtml, busTripLd } from '../index';

describe('jsonLdHtml', () => {
  it('escapes < > & so a </script> breakout cannot close the inline script', () => {
    const out = jsonLdHtml({ name: '</script><script>alert(1)</script>' });
    // No raw angle brackets or ampersands survive.
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).not.toContain('&');
    expect(out).not.toContain('</script');
    // The dangerous chars become their JSON \uXXXX escapes.
    expect(out).toContain('\\u003c'); // <
    expect(out).toContain('\\u003e'); // >
  });

  it('escapes U+2028 / U+2029 line separators', () => {
    const out = jsonLdHtml({ name: `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c` });
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
  });

  it('stays valid JSON, semantically identical after escaping', () => {
    const payload = busTripLd({
      origin: 'Hà Nội </script>',
      destination: 'Sài Gòn',
      departureTime: '2026-08-13T08:00:00.000Z',
      price: 250000,
      operatorName: 'Nhà xe <b>X</b> & Co',
      url: 'https://x/y',
    });
    const html = jsonLdHtml(payload);
    expect(html).not.toContain('</script');
    // Round-trips to the original object (escapes are transparent to a JSON parser).
    expect(JSON.parse(html)).toEqual(payload);
  });
});
