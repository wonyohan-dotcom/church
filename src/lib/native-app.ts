import { headers } from "next/headers";
import { prisma } from "./prisma";
import { TRIAL } from "./demo";

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

/**
 * 교회 소통(사진·댓글·채팅)을 App Store 앱 안에서 보여 줄지.
 * 사용자가 올리는 글이 있는 기능은 애플이 따로 심사하므로(지침 1.2), 앱 심사가 끝나기 전에는
 * 심사원이 쓰는 체험·시험 교회에서만 숨기고, 실제 교회에서는 앱 안에서도 보인다.
 * 웹 브라우저에서는 모든 교회가 바로 쓸 수 있다.
 */
export const COMMUNITY_IN_REVIEW_CHURCHES = false;

export async function communityEnabled(churchId: string): Promise<boolean> {
  if (COMMUNITY_IN_REVIEW_CHURCHES || !(await isNativeApp())) return true;
  const church = await prisma.church.findUnique({ where: { id: churchId }, select: { isDemo: true, name: true } });
  return !!church && !church.isDemo && church.name !== TRIAL.churchName;
}
