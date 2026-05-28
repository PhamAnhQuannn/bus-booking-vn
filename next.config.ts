import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
