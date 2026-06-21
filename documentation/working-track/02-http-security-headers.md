# 02 -- OWASP HTTP Security Headers

## Status: DONE

## What changed

Added full OWASP security header set via `next.config.ts` `headers()` function per ADR-008 D4:

1. `X-Content-Type-Options: nosniff`
2. `X-Frame-Options: DENY`
3. `Referrer-Policy: strict-origin-when-cross-origin`
4. `Permissions-Policy: camera=(), microphone=(), geolocation=()`
5. `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (production only)
6. `Content-Security-Policy` with `default-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`

CSP includes dev-mode websocket/localhost origins for HMR. HSTS excluded in dev.

## Files modified

- `next.config.ts` — added `securityHeaders` array + `async headers()` function

## Verification

- `pnpm tsc --noEmit` — clean
- `curl -I localhost:3001` — verify all headers present in response
- CSP `connect-src` will need SePay origin added when WT-03 ships
