import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl plugin — points at the per-request i18n config (message loading).
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isProd = process.env.NODE_ENV === 'production';
const hasSentry = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
      // *.sentry.io (not *.ingest.sentry.io): regionalized DSNs use an extra label,
      // e.g. o<org>.ingest.us.sentry.io / .de.sentry.io, which *.ingest.sentry.io does NOT match.
      `connect-src 'self'${hasSentry ? ' https://*.sentry.io' : ''}${isProd ? '' : ' ws://localhost:* http://localhost:*'}`,
      "img-src 'self' data: blob: https://img.vietqr.io",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: 'standalone',
  // Hero LCP is served via next/image; prefer AVIF (smaller + sharper) then WebP.
  // `qualities` allowlists the non-default q=90 the hero <Image> requests (Next 16).
  images: { formats: ['image/avif', 'image/webp'], qualities: [75, 90] },
  // argon2 is a native addon (P19 password hashing). Mark it external so webpack does
  // not try to bundle the `.node` binary; Next then requires it at runtime and includes
  // it in the standalone trace. Its import in lib/auth/password.ts is a normal dynamic
  // import so file-tracing sees it.
  serverExternalPackages: ['argon2'],
  // 2026-06-06: allow the VS Code devtunnel origin in `next dev` so cross-origin
  // /_next assets, HMR, and server actions are not blocked when the app is reached
  // through the forwarded HTTPS tunnel. Dev-only key; ignored in production builds.
  allowedDevOrigins: ['*.devtunnels.ms'],
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  async redirects() {
    return [
      // PR 2: booking queue + detail moved from /op/dashboard → /op/bookings.
      // /op/dashboard is now the analytics landing; preserve old detail bookmarks.
      {
        source: "/op/dashboard/:id",
        destination: "/op/bookings/:id",
        permanent: true,
      },
    ];
  },
};

// Sentry source-map upload so prod stack traces symbolicate to real files/functions/lines
// instead of minified chunks. org/project/authToken are resolved from SENTRY_ORG /
// SENTRY_PROJECT / SENTRY_AUTH_TOKEN (Vercel Production, build scope) — no literals here. A
// missing token warns + SKIPS upload (local `pnpm build` + CI stay green, never abort). On the
// Turbopack path (Next 16 default) this auto-enables productionBrowserSourceMaps, sets
// deleteSourcemapsAfterUpload=true, and strips sourceMappingURL comments, so maps are uploaded
// then removed — never publicly served. Debug IDs handle symbolication (no release-name match
// needed). instrumentation.ts / instrumentation-client.ts remain the sole Sentry.init() sites —
// withSentryConfig only touches the build pipeline, so there is no double-init.
export default withNextIntl(withSentryConfig(nextConfig, {}));
