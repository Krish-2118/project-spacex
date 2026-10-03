import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The default dev badge sits on top of the fixed HUD's INSTAGRAM link.
  // Compile/runtime errors are still surfaced with this off.
  devIndicators: false,
};

export default nextConfig;
