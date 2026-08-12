"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";
import { STAFF_ROLES, type Role } from "@/lib/constants";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const loginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!loginId || !password) {
    return { error: "아이디와 비밀번호를 모두 입력해 주세요." };
  }

  const user = await prisma.user.findUnique({ where: { loginId } });

  // 아이디가 없을 때도 같은 문구를 돌려줘 계정 존재 여부가 새지 않게 한다.
  if (!user || !user.active || !(await verifyPassword(password, user.password))) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession({
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    role: user.role as Role,
    memberId: user.memberId,
  });

  const staff = STAFF_ROLES.includes(user.role as Role);
  const fallback = staff ? "/dashboard" : "/my";
  // 열린 리다이렉트를 막기 위해 내부 경로만 허용한다.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : fallback;
  redirect(staff ? target : fallback);
}
