import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.2.31'],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
