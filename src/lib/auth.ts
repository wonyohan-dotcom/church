import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { FINANCE_ROLES, PASTORAL_ROLES, STAFF_ROLES, type Role } from "./constants";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSessionToken,
  verifySessionToken,
  type SessionUser,
} from "./session";

export { SESSION_COOKIE, verifySessionToken };
export type { SessionUser };

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: SessionUser) {
  const token = await signSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * 로그인 필수. 승인이 나지 않은 계정은 대기 화면으로 보낸다.
 * 반환값의 churchId 는 이후 모든 조회의 범위가 된다.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  // 로그인을 오래 유지하므로, 계정이 지워졌거나 권한이 바뀐 경우를 여기서 바로잡는다.
  const row = await prisma.user.findUnique({
    where: { id: session.id },
    select: { role: true, status: true, name: true, memberId: true, churchId: true, church: { select: { name: true } } },
  });
  if (!row || row.churchId !== session.churchId) redirect("/api/session-expired");
  const user: SessionUser = {
    ...session,
    role: row.role as Role,
    status: row.status as SessionUser["status"],
    name: row.name,
    memberId: row.memberId,
    churchName: row.church.name,
  };
  if (user.status !== "ACTIVE") redirect("/pending");
  return user;
}

/** 교적·회계·역사 등 관리 화면 접근 권한 */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!STAFF_ROLES.includes(user.role)) redirect("/my");
  return user;
}

/** 회계 데이터 변경 권한 */
export async function requireFinance(): Promise<SessionUser> {
  const user = await requireUser();
  if (!FINANCE_ROLES.includes(user.role)) redirect("/dashboard?error=forbidden");
  return user;
}

/** 심방·상담 기록 권한 (관리자·교역자) */
export async function requirePastoral(): Promise<SessionUser> {
  const user = await requireUser();
  if (!PASTORAL_ROLES.includes(user.role)) redirect("/dashboard?error=forbidden");
  return user;
}

export function canPastoral(role: Role) {
  return PASTORAL_ROLES.includes(role);
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard?error=forbidden");
  return user;
}

export function canManageFinance(role: Role) {
  return FINANCE_ROLES.includes(role);
}

export function isStaff(role: Role) {
  return STAFF_ROLES.includes(role);
}
