import type { Metadata, Viewport } from "next";
import { Noto_Serif_KR } from "next/font/google";
import "./pretendard.css";
import "./globals.css";

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
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#111318" },
  ],
};

// 본문 글꼴(Pretendard)은 public/fonts 에 들어 있다. 제목용 명조는 빌드할 때 받아 함께 배포한다.
// 한글은 글자 수가 많아 미리 받지 않고(preload: false) 화면에 쓰인 글자 조각만 내려받는다.
const serif = Noto_Serif_KR({
  weight: ["600", "700"],
  preload: false,
  display: "swap",
  variable: "--font-serif-kr",
});

// 저장된 테마를 첫 페인트 전에 적용해 화면 깜빡임을 막는다.
const THEME_INIT = `try{var t=localStorage.getItem('church-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning className={serif.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />

      </head>
      <body>{children}</body>
    </html>
  );
}
