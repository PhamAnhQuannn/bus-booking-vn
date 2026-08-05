// Security-headers smoke (read-only GET). Asserts the 6 OWASP headers configured in next.config.ts.
// Strict-Transport-Security is only emitted over HTTPS/prod — on a localhost http target it is
// expected ABSENT (not a failure). No false-positive on local.
import type { Check } from './http-asserts.mjs';

const HEADERS = [
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'content-security-policy',
];
const HTTPS_ONLY = 'strict-transport-security';

export async function headersCheck(baseUrl: string): Promise<Check[]> {
  const res = await fetch(`${baseUrl}/`);
  const isHttps = baseUrl.startsWith('https://');
  const out: Check[] = HEADERS.map((h) => ({
    name: `header ${h}`,
    ok: res.headers.get(h) !== null,
  }));
  const sts = res.headers.get(HTTPS_ONLY) !== null;
  out.push({
    name: `header ${HTTPS_ONLY}`,
    ok: isHttps ? sts : true, // localhost: absent is fine
    detail: isHttps ? (sts ? 'present' : 'MISSING on https') : `${sts ? 'present' : 'absent'} (n/a on http)`,
  });
  return out;
}
