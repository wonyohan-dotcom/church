import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 교인 사진 · 영수증 사진을 서버 액션으로 올린다. 기본은 1MB 라 사진 한 장도
    // 못 넘긴다. Vercel 은 이 값을 아무리 올려도 요청 하나당 4.5MB 를 절대 넘기지
    // 못하게 막아 두므로(설정으로 못 바꾼다), 그 안에서 여유를 두고 4mb 로 잡는다.
    // upload.ts 의 MAX_BYTES(4MB) 와 짝을 맞춘 값이다.
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
