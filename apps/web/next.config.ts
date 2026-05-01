import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tvchat/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
    ],
  },
};

export default nextConfig;
