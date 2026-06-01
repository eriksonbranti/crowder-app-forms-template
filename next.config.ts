import type { NextConfig } from "next"

// /embed/* is framable by design — per-form origin enforcement happens at
// runtime via requireAllowedOrigin (src/lib/http.ts) on the API side and the
// iframe postMessage handler client-side. All other routes DENY framing.
const baseSecurityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
]

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/embed/:path*",
      headers: [
        ...baseSecurityHeaders,
        { key: "Content-Security-Policy", value: "frame-ancestors *" },
      ],
    },
    {
      source: "/((?!embed/).*)",
      headers: [
        ...baseSecurityHeaders,
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      ],
    },
  ],
}

export default nextConfig
