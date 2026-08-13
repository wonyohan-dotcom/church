import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "심플한교회관리",
    short_name: "심플한교회관리",
    description: "교적 · 회계 · 기부금영수증 · 교회 역사를 한 곳에서",
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
