import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The default dev badge sits on top of the fixed HUD's INSTAGRAM link.
  // Compile/runtime errors are still surfaced with this off.
  devIndicators: false,
  async headers() {
    return [
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
