import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  // The extraction libraries are loaded inside bounded Node workers, whose
  // runtime imports are intentionally opaque to the application bundler.
  outputFileTracingIncludes: {
    "/api/member/career-documents": [
      "./node_modules/mammoth/**/*",
      "./node_modules/pdfjs-dist/package.json",
      "./node_modules/pdfjs-dist/legacy/build/pdf.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
  },
  serverExternalPackages: ["mammoth", "pino"],
  typedRoutes: true,
};

export default nextConfig;
