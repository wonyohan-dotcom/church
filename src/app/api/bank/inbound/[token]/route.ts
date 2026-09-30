import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestBankText } from "@/lib/bank";

export const dynamic = "force-dynamic";

/**
 * 휴대폰 단축어가 은행 입출금 문자를 보내는 주소.
 *
 * 로그인 대신 주소에 들어 있는 교회별 비밀 열쇠(token)로 교회를 찾는다.
 * 열쇠는 설정 화면에서 언제든 새로 만들 수 있고, 새로 만들면 이전 주소는 바로 막힌다.
 * 이 주소로 할 수 있는 일은 "알림을 알림함에 넣는 것" 하나뿐이다.
 *
 * 단축어 앱마다 보내는 방식이 달라서 JSON, 양식(form), 그냥 글자 모두 받는다.
 */

async function churchFor(token: string) {
  if (!token || token.length < 20) return null;
  return prisma.church.findUnique({ where: { bankToken: token }, select: { id: true, name: true } });
}

async function readText(req: NextRequest): Promise<string> {
  const type = req.headers.get("content-type") ?? "";
  const pick = (o: Record<string, unknown>) => {
    for (const key of ["text", "message", "body", "content", "sms", "문자"]) {
      const v = o[key];
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  };

  if (type.includes("application/json")) {
    const data = await req.json().catch(() => null);
    if (typeof data === "string") return data;
    if (data && typeof data === "object") return pick(data as Record<string, unknown>);
    return "";
  }
  if (type.includes("form")) {
    const form = await req.formData().catch(() => null);
    if (!form) return "";
    const entries: Record<string, unknown> = {};
    for (const [k, v] of form.entries()) entries[k] = typeof v === "string" ? v : "";
    return pick(entries);
  }
  return req.text();
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const church = await churchFor(token);
  if (!church) {
    return NextResponse.json({ ok: false, 결과: "주소가 올바르지 않습니다." }, { status: 404 });
  }

  const text = (await readText(req)).slice(0, 5000);
  if (!text.trim()) {
    return NextResponse.json({ ok: false, 결과: "받은 내용이 비어 있습니다." }, { status: 400 });
  }

  const result = await ingestBankText(church.id, text, "SHORTCUT");
  const 결과 =
    result.saved.length > 0
      ? "알림함에 넣었습니다."
      : result.duplicates > 0
        ? "이미 받은 문자입니다."
        : "입출금 문자가 아니라서 넘어갔습니다.";

  return NextResponse.json({ ok: true, 결과 });
}

/** 사파리에서 주소를 열어 연결이 되는지 확인할 수 있게 한다. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const church = await churchFor(token);
  if (!church) {
    return NextResponse.json({ ok: false, 결과: "주소가 올바르지 않습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, 결과: `${church.name} 입출금 알림 주소가 맞습니다.` });
}
