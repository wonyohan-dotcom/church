import { NextResponse, type NextRequest } from "next/server";
import { pingBackends } from "@/lib/db-ping";

export const dynamic = "force-dynamic";

/**
 * Vercel 크론(vercel.json)이 매일 부르는 주소.
 * Supabase 가 활동이 없다고 판단해 잠들지 않도록 실제 질의를 몇 번 보낸다.
 *
 * CRON_SECRET 환경변수를 넣어 두면 Vercel 이 그 값을 Authorization 헤더로 붙여 보내고,
 * 이 주소는 그 요청만 받는다. 넣지 않았다면 누구나 부를 수 있지만 하는 일은
 * "연결됨/실패" 확인뿐이라 드러나는 정보가 없다.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await pingBackends();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
