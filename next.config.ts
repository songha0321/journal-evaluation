import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// `next dev`에서도 Cloudflare 바인딩(env.DB = 로컬 D1)을 쓴다. mock 모드는 없다.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  async redirects() {
    // 1차 FE 경로 → 데이터 관리(/data/*). 2026-09-14 2회차.
    return [
      { source: "/dashboard", destination: "/data", permanent: true },
      { source: "/essays", destination: "/data/authors", permanent: true },
      { source: "/essays/:authorId", destination: "/data/authors/:authorId", permanent: true },
      { source: "/evaluations", destination: "/data/evaluations", permanent: true },
    ];
  },
};

export default nextConfig;
