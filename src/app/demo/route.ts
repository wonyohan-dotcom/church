import { NextResponse, type NextRequest } from "next/server";
import { createSession } from "@/lib/auth";
import { ensureDemo } from "@/lib/demo";
import type { Role, UserStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * 로그인 화면의 '체험해 보기'. 체험용 교회 관리자로 바로 들어간다.
 * 체험용 교회는 예시 자료만 들어 있고 매일 새로 채워지므로 누구에게 열어 두어도 괜찮다.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await ensureDemo();
    await createSession({
      id: user.id,
      loginId: user.loginId,
      name: user.name,
      role: user.role as Role,
      status: user.status as UserStatus,
      churchId: user.churchId,
      churchName: user.church.name,
      memberId: user.memberId,
    });
    return NextResponse.redirect(new URL("/dashboard", req.url), 303);
  } catch (e) {
    console.error("체험용 교회를 열지 못했습니다", e);
    return NextResponse.redirect(new URL("/login?demo=fail", req.url), 303);
  }
}
