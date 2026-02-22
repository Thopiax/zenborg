import type { NextConfig } from "next";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT_MODE === "export" ? { output: "export" } : {}),
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
