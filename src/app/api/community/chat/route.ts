import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_CHAT_BODY, blockedIdsOf, communityUserOrNull, isModerator } from "@/lib/community";

/** 전체 채팅. 화면이 몇 초마다 GET 으로 새 글을 가져온다. */
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

export async function GET(req: NextRequest) {
  const user = await communityUserOrNull();
  if (!user) return unauthorized();

  const afterRaw = req.nextUrl.searchParams.get("after");
  const after = afterRaw ? new Date(afterRaw) : null;
  const blocked = await blockedIdsOf(user.id);

  const rows = await prisma.chatMessage.findMany({
    where: {
      churchId: user.churchId,
      authorId: blocked.length ? { notIn: blocked } : undefined,
      ...(after && !Number.isNaN(after.getTime()) ? { createdAt: { gt: after } } : {}),
    },
    orderBy: { createdAt: after ? "asc" : "desc" },
    take: after ? 200 : 60,
    include: { author: { select: { id: true, name: true } } },
  });
  if (!after) rows.reverse();

  return NextResponse.json({
    me: user.id,
    canModerate: isModerator(user),
    messages: rows.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      authorId: m.author.id,
      authorName: m.author.name,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await communityUserOrNull();
  if (!user) return unauthorized();

  const json = (await req.json().catch(() => null)) as { body?: unknown } | null;
  const body = typeof json?.body === "string" ? json.body.trim().slice(0, MAX_CHAT_BODY) : "";
  if (!body) return NextResponse.json({ error: "내용을 입력해 주세요." }, { status: 400 });

  // 도배 방지: 10초에 10개까지
  const recent = await prisma.chatMessage.count({
    where: { authorId: user.id, createdAt: { gt: new Date(Date.now() - 10_000) } },
  });
  if (recent >= 10) return NextResponse.json({ error: "잠시 뒤에 보내 주세요." }, { status: 429 });

  const message = await prisma.chatMessage.create({ data: { churchId: user.churchId, authorId: user.id, body } });

  // 오래된 대화는 가끔 정리한다 (90일).
  if (Math.random() < 0.02) {
    await prisma.chatMessage.deleteMany({
      where: { churchId: user.churchId, createdAt: { lt: new Date(Date.now() - 90 * 86_400_000) } },
    });
  }
  return NextResponse.json({ id: message.id });
}

export async function DELETE(req: NextRequest) {
  const user = await communityUserOrNull();
  if (!user) return unauthorized();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const message = await prisma.chatMessage.findUnique({ where: { id } });
  if (!message || message.churchId !== user.churchId) return NextResponse.json({ ok: true });
  if (message.authorId !== user.id && !isModerator(user)) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  await prisma.chatMessage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
