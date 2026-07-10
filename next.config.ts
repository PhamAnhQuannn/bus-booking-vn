import type { NextConfig } from "next";

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
      `connect-src 'self'${hasSentry ? ' https://*.ingest.sentry.io' : ''}${isProd ? '' : ' ws://localhost:* http://localhost:*'}`,
      "img-src 'self' data: blob:",
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

export default nextConfig;
