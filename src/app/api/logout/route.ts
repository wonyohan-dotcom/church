import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/auth";

/** 로그아웃. next 에 정해진 화면(교회 등록)이 있으면 그리로 보낸다. */
export async function POST(req: NextRequest) {
  await destroySession();
  const next = req.nextUrl.searchParams.get("next") === "register" ? "/register-church" : "/login";
  return NextResponse.redirect(new URL(next, req.url), { status: 303 });
}
