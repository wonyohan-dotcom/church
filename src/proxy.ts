import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { STAFF_ROLES, type Role } from "@/lib/constants";

const PUBLIC_PATHS = ["/login", "/setup"];
/** 성도(MEMBER) 역할도 접근 가능한 경로 */
const MEMBER_PATHS = ["/my"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  const staff = STAFF_ROLES.includes(user.role as Role);

  // 성도는 본인 포털만 볼 수 있다.
  if (!staff && !MEMBER_PATHS.some((p) => pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = "/my";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 정적 파일과 업로드 이미지를 제외한 모든 경로를 보호한다.
     */
    "/((?!api/|_next/static|_next/image|uploads/|favicon.ico|icon.svg|manifest.webmanifest).*)",
  ],
};
