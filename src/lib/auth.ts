import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { FINANCE_ROLES, STAFF_ROLES, type Role } from "./constants";
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

/** 로그인 필수. 미로그인 시 로그인 화면으로 보낸다. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
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
