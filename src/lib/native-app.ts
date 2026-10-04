import { headers } from "next/headers";

/**
 * App Store 앱(Capacitor 껍데기) 안에서 열린 화면인지.
 * 앱 안에서는 교회(단체) 등록을 보여 주지 않는다 — 애플 3.1.1 심사 지침.
 * 교회 등록은 웹 브라우저에서 하고, 앱에서는 그 계정으로 로그인한다.
 *
 * 새 빌드는 사용자 에이전트에 "SimpleChurchApp" 표식을 붙이고,
 * 이미 배포된 빌드는 WKWebView 에 Safari/Chrome 표식이 없다는 점으로 알아본다.
 */
export async function isNativeApp(): Promise<boolean> {
  const ua = (await headers()).get("user-agent") ?? "";
  if (ua.includes("SimpleChurchApp")) return true;
  return /iPhone|iPad|iPod/.test(ua) && /AppleWebKit/.test(ua) && !/Safari\/|CriOS|FxiOS|EdgiOS/.test(ua);
}
