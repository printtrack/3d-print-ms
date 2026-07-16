import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  devIndicators: false,
  output: 'standalone',
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // node-ical (and its rrule/ical.js deps) must run as a real Node module, not be
  // bundled by Turbopack — bundling breaks its BigInt usage ("e.BigInt is not a function").
  serverExternalPackages: ["node-ical"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // SAMEORIGIN, not DENY: the landing page editor (/admin/landing)
          // previews the live page in an iframe. Third-party origins still
          // cannot frame the app, so clickjacking protection is unchanged —
          // see frame-ancestors below, which says the same thing to modern
          // browsers and takes precedence over this header.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "worker-src 'self' blob:",
              // 'self', not 'none': the landing page editor embeds the live
              // landing page to preview it. Only our own pages may be framed,
              // and only by our own pages (frame-ancestors) — no third-party
              // origin can embed the CMS, and no third-party page can be
              // embedded into it.
              "frame-src 'self'",
              "frame-ancestors 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
