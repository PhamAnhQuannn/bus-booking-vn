/**
 * Extract client IP from request headers.
 *
 * Prefers x-real-ip (set by reverse proxies like Vercel/nginx — not
 * spoofable by the client) over x-forwarded-for (client-spoofable).
 * Edge-safe: uses only the Web Headers API.
 */
export function clientIp(headers: Headers): string {
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();

  return '127.0.0.1';
}
