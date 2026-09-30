import { NextResponse, type NextRequest } from "next/server";
import { createSession } from "@/lib/auth";
import { DEMO, ensureDemo } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import type { Role, UserStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * 로그인 화면의 '둘러보기'. 체험용 교회에 관리자(기본) 또는 성도(?as=member)로 바로 들어간다.
 * 체험용 교회는 예시 자료만 들어 있고 매일 새로 채워지므로 누구에게 열어 두어도 괜찮다.
 */
export async function GET(req: NextRequest) {
  const asMember = req.nextUrl.searchParams.get("as") === "member";
  try {
    const admin = await ensureDemo();
    const user = asMember
      ? await prisma.user.findUniqueOrThrow({
          where: { loginId: DEMO.member.loginId },
          include: { church: { select: { id: true, name: true, isDemo: true } } },
        })
      : admin;
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
    return NextResponse.redirect(new URL(asMember ? "/my" : "/dashboard", req.url), 303);
  } catch (e) {
    console.error("체험용 교회를 열지 못했습니다", e);
    return NextResponse.redirect(new URL("/login?demo=fail", req.url), 303);
  }
}
