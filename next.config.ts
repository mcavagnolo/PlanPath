import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/PlanPath',
  images: {
    unoptimized: true,
  },
  // Fix for pdfjs-dist "canvas" dependency issue in Next.js
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

export default nextConfig;
