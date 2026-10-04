import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/auth";

/** 계정이 없어졌거나 정지된 로그인 쿠키를 지우고 로그인 화면으로 보낸다. */
export async function GET(req: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
