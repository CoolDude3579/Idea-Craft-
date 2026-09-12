import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
};

export { config };
export default config;
