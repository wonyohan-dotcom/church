import { NextResponse, type NextRequest } from "next/server";
import { resetDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 매일 새벽 체험용 교회를 예시 자료로 다시 채운다 (vercel.json 크론).
 * CRON_SECRET 을 넣어 두면 Vercel 크론 요청만 받는다. 넣지 않았다면 누구나 부를 수 있지만
 * 하는 일은 체험용 교회를 다시 채우는 것뿐이다.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const church = await resetDemo();
  return NextResponse.json({ ok: true, church: church.name });
}
