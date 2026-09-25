import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  // packages/vault and packages/dbc ship raw TypeScript with no build step.
  transpilePackages: ["@portage/vault", "@portage/dbc"],
};

export default nextConfig;
