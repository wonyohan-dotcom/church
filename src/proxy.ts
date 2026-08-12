import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { STAFF_ROLES, type Role } from "@/lib/constants";

/** 로그인하지 않아도 볼 수 있는 화면 */
const PUBLIC_PATHS = ["/login", "/signup", "/register-church"];
/** 승인 대기 중인 계정도 볼 수 있는 화면 */
const PENDING_PATHS = ["/pending"];
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

  const pendingPage = PENDING_PATHS.some((p) => pathname.startsWith(p));

  // 아직 승인되지 않은 계정은 대기 화면만 볼 수 있다.
  if (user.status !== "ACTIVE") {
    if (pendingPage) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/pending";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 승인된 사람이 대기 화면에 오면 제자리로 보낸다.
  if (pendingPage) {
    const url = req.nextUrl.clone();
    url.pathname = STAFF_ROLES.includes(user.role as Role) ? "/dashboard" : "/my";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 성도는 본인 포털만 볼 수 있다.
  if (!STAFF_ROLES.includes(user.role as Role) && !MEMBER_PATHS.some((p) => pathname.startsWith(p))) {
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
     * (업로드 경로는 라우트 안에서 직접 로그인 여부를 확인한다)
     */
    "/((?!api/|_next/static|_next/image|uploads/|favicon.ico|icon.svg|sw.js|manifest.webmanifest).*)",
  ],
};
