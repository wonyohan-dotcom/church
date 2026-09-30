import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "심플한 교회관리",
    short_name: "심플한 교회관리",
    description: "교적 · 회계 · 기부금영수증 · 교회 역사를 한 곳에서",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ee",
    theme_color: "#142f3b",
    lang: "ko",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
