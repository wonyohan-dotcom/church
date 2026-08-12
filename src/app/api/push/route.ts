import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPublicKey, pushConfigured } from "@/lib/push";

/** 브라우저가 구독을 만들 때 필요한 공개키를 알려 준다. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!pushConfigured()) {
    return NextResponse.json({ configured: false, publicKey: null });
  }

  const subscriptions = await prisma.pushSubscription.count({
    where: { userId: session.id },
  });

  return NextResponse.json({
    configured: true,
    publicKey: getPublicKey(),
    subscriptions,
  });
}

/** 이 기기에서 알림을 받겠다고 등록한다. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    label?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const { endpoint, keys, label } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  // 같은 기기에서 다시 등록하면 주인만 바꿔 준다. (공용 PC 대응)
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId: session.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
      label: label ?? null,
      lastUsedAt: new Date(),
    },
    create: {
      endpoint,
      userId: session.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
      label: label ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}

/** 이 기기에서 알림 받기를 그만둔다. */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint");

  if (endpoint) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.id },
    });
  } else {
    await prisma.pushSubscription.deleteMany({ where: { userId: session.id } });
  }

  return NextResponse.json({ ok: true });
}
