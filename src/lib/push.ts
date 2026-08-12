import webpush from "web-push";
import { prisma } from "./prisma";
import type { Role } from "./constants";

/**
 * 웹 푸시 알림.
 *
 * VAPID 키가 설정되지 않았다면 알림 기능 전체가 조용히 꺼진다.
 * 알림이 안 온다고 해서 헌금 입력이나 영수증 발급이 막히면 안 되기 때문이다.
 */

export function pushConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

export function getPublicKey() {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** 알림을 눌렀을 때 열 화면 */
  url?: string;
  /** 같은 tag 의 알림은 하나로 합쳐진다 */
  tag?: string;
};

async function sendToUsers(userIds: string[], payload: PushPayload) {
  if (!ensureConfigured() || userIds.length === 0) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  const expired: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
      } catch (err) {
        // 404 · 410 은 사용자가 알림을 껐거나 앱을 지운 경우다. 구독을 정리한다.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(sub.id);
      }
    }),
  );

  if (expired.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: expired } } });
  }
}

/** 같은 교회의 특정 권한을 가진 사람들에게 보낸다. (예: 회계 담당자) */
export async function notifyRoles(
  churchId: string,
  roles: Role[],
  payload: PushPayload,
) {
  if (!ensureConfigured()) return;

  const users = await prisma.user.findMany({
    where: { churchId, status: "ACTIVE", role: { in: roles } },
    select: { id: true },
  });

  await sendToUsers(
    users.map((u) => u.id),
    payload,
  );
}

/** 특정 교인에게 연결된 계정으로 보낸다. */
export async function notifyMember(memberId: string, payload: PushPayload) {
  if (!ensureConfigured()) return;

  const user = await prisma.user.findUnique({
    where: { memberId },
    select: { id: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return;

  await sendToUsers([user.id], payload);
}

export async function notifyUser(userId: string, payload: PushPayload) {
  await sendToUsers([userId], payload);
}
