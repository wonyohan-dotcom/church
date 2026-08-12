import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "교회 통합 관리 시스템",
    short_name: "교회관리",
    description: "교적 · 회계 · 기부금영수증 · 교회 역사 관리",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f2",
    theme_color: "#22355c",
    lang: "ko",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
