import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 2026-06-06: allow the VS Code devtunnel origin in `next dev` so cross-origin
  // /_next assets, HMR, and server actions are not blocked when the app is reached
  // through the forwarded HTTPS tunnel. Dev-only key; ignored in production builds.
  allowedDevOrigins: ['93ppgcdj-3001.usw3.devtunnels.ms', '*.devtunnels.ms'],
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
