import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  async redirects() {
    return [
      { source: "/methodology/:path*", destination: "/", permanent: false },
      { source: "/evidence/:path*", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
