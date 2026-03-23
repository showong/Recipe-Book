import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Docker 최소 이미지를 위한 standalone 빌드
};

export default nextConfig;
