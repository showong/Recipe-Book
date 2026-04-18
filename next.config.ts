import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 빌드 시에만 standalone 활성화 (NEXT_OUTPUT=standalone)
  // Vercel 배포 시에는 이 값이 없으므로 자동으로 일반 모드로 동작
  ...(process.env.NEXT_OUTPUT === "standalone" && { output: "standalone" }),
  allowedDevOrigins: ["192.168.56.1", "192.168.56.0/24"],
};

export default nextConfig;
