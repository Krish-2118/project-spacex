import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** Origin of an env-configured URL, or null if unset/invalid. */
function originOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

const supabaseOrigin = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? "https://*.supabase.co";
const imagekitOrigin =
  originOf(process.env.IMAGEKIT_URL_ENDPOINT || process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT) ?? "https://ik.imagekit.io";

// Next.js App Router injects inline bootstrap scripts, so script-src needs 'unsafe-inline' unless every page is
// rendered with per-request nonces. Even so, this blocks third-party script hosts, plugin content, framing, <base>
// hijacking, off-site form posts and exfiltration to arbitrary origins via fetch/XHR/WebSocket.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Supabase origin: staff preview payment screenshots through short-lived signed Storage URLs.
  `img-src 'self' data: blob: ${[...new Set([imagekitOrigin, "https://ik.imagekit.io"])].join(" ")} ${supabaseOrigin} https://*.googleusercontent.com`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^https:/, "wss:")}`,
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  // The default dev badge sits on top of the fixed HUD's INSTAGRAM link.
  // Compile/runtime errors are still surfaced with this off.
  devIndicators: false,
  // Dev-only: lets a phone on the same Wi-Fi load HMR and other dev resources from this laptop's LAN IP.
  // Hostnames only (no scheme/port); update it if the laptop's IPv4 address changes.
  allowedDevOrigins: ["192.168.0.129"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        // The check-in scanner needs the camera. Must stay AFTER the global "/:path*" entry: when two entries set the
        // same header for a path, the last one wins (Next.js headers docs, "Header Overriding Behavior").
        source: "/admin/scan",
        headers: [
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
      {
        // API responses carry personal data and tokens: never let a browser or CDN cache them. The three public,
        // anonymous endpoints (events, gallery, seats) are excluded and set their own cache headers.
        source: "/api/:path((?!events$|gallery$|seats$).*)",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
      {
        // Art, sound and fonts in public/assets. Their names carry no content hash, so a changed file keeps its
        // URL: browsers reuse a copy for a week, then serve it while revalidating for a day more. `immutable`
        // (with a year's max-age) would only be safe if every file were renamed whenever its content changes.
        source: "/assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
