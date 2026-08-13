/**
 * resolveBaseUrl — the trusted public origin for building outbound links (SEC-BASEURL, #565).
 *
 * `Host` / `X-Forwarded-Host` are client-settable, so deriving an email/redirect/payment base URL
 * from them lets a spoofed header poison the link. Prefer the deploy-set `NEXT_PUBLIC_BASE_URL`
 * (validated in lib/config/env.ts); fall back to the request-derived origin ONLY when it is unset
 * (local dev / preview) — where there is no trusted env and the host is not attacker-controlled in
 * practice. Mirrors the pattern already used by the Google OAuth callback.
 */

import type { NextRequest } from 'next/server';

export function resolveBaseUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (env) return env;
  const proto =
    req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(/:$/, '') ?? 'http';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  return `${proto}://${host}`;
}
