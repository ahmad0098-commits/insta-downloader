import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Images from Instagram CDNs are shown via a normal <img> tag with a
  // server-side proxy route when needed, so no remotePatterns are required.
  // The download proxy lives at /api/download and only accepts URLs that the
  // server itself produced — never client-provided arbitrary URLs.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
