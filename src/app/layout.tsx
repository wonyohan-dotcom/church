import type { Metadata, Viewport } from "next";
import "./pretendard.css";
import "./globals.css";
import { SwipeBack } from "@/components/swipe-back";

export const metadata: Metadata = {
  title: {
    default: "심플한 교회관리",
    template: "%s · 심플한 교회관리",
  },
  description: "교적 · 회계 · 기부금영수증 · 교회 역사를 한 곳에서 관리합니다.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "심플한 교회관리" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#17171c" },
  ],
};

// 본문 글꼴(Pretendard)은 public/fonts 에 들어 있다. 제목도 같은 글꼴을 굵게 쓴다.

// 저장된 테마를 첫 페인트 전에 적용해 화면 깜빡임을 막는다.
const THEME_INIT = `try{var t=localStorage.getItem('church-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />

      </head>
      <body>
        {children}
        <SwipeBack />
      </body>
    </html>
  );
}
