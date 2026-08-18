import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 교인 사진 · 지출 영수증 사진을 서버 액션으로 올린다. 휴대폰 카메라 원본은
    // 흔히 5~10MB 라, 기본 1MB 로는 대부분의 사진이 막힌다.
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
