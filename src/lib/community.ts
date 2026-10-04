import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { communityEnabled } from "./native-app";
import { requireUser, getSession } from "./auth";
import type { SessionUser } from "./session";

/** 사진·채팅·콘티 같은 교회 소통 기능에서 쓰는 도우미 */

export * from "./community-limits";

export { REPORT_REASONS } from "./community-reasons";

/** 소통 기능 이용 약관에 동의한 로그인 사용자. 동의 전이면 안내 화면으로 보낸다. */
export async function requireCommunityUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await communityEnabled())) redirect("/");
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { communityAgreedAt: true } });
  if (!row?.communityAgreedAt) redirect("/community");
  return user;
}

/** API 용: 로그인·승인·약관 동의가 모두 된 사용자만. 아니면 null. */
export async function communityUserOrNull(): Promise<SessionUser | null> {
  if (!(await communityEnabled())) return null;
  const session = await getSession();
  if (!session) return null;
  const row = await prisma.user.findUnique({
    where: { id: session.id },
    select: { status: true, churchId: true, role: true, name: true, communityAgreedAt: true },
  });
  if (!row || row.status !== "ACTIVE" || row.churchId !== session.churchId || !row.communityAgreedAt) return null;
  return { ...session, role: row.role as SessionUser["role"], name: row.name };
}

export function isModerator(user: SessionUser) {
  return user.role === "ADMIN";
}

/** 내가 차단한 사람들의 ID */
export async function blockedIdsOf(userId: string): Promise<string[]> {
  const rows = await prisma.userBlock.findMany({ where: { blockerId: userId }, select: { blockedId: true } });
  return rows.map((r) => r.blockedId);
}

/** "방금", "5분 전", "어제"… */
export function timeAgo(date: Date, now = new Date()): string {
  const sec = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (sec < 45) return "방금";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.round(hour / 24);
  if (day < 7) return `${day}일 전`;
  const kst = new Date(date.getTime() + 9 * 3600_000);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}
