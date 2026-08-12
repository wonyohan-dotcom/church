"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword, requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/church";
import { DEFAULT_ACCOUNTS, ROLES, type Role } from "@/lib/constants";
import { str } from "@/lib/format";
import { notifyRoles, notifyUser } from "@/lib/push";

/* ── 교회 등록 ───────────────────────────── */

export type RegisterState = { error?: string };

/**
 * 새 교회를 만들고, 만든 사람을 그 교회의 관리자로 등록한다.
 * 기본 계정과목까지 함께 깔아 두어 바로 회계 입력을 시작할 수 있다.
 */
export async function registerChurch(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const churchName = str(formData.get("churchName"));
  const name = str(formData.get("name"));
  const loginId = str(formData.get("loginId"));
  const password = String(formData.get("password") ?? "");
  const phone = str(formData.get("phone"));

  if (!churchName) return { error: "교회 이름을 입력해 주세요." };
  if (!name) return { error: "담당자 이름을 입력해 주세요." };
  if (!loginId || loginId.length < 4) {
    return { error: "아이디는 4자 이상으로 정해 주세요." };
  }
  if (password.length < 8) {
    return { error: "비밀번호는 8자 이상으로 정해 주세요." };
  }
  if (await prisma.user.findUnique({ where: { loginId } })) {
    return { error: "이미 사용 중인 아이디입니다. 다른 아이디를 써 주세요." };
  }

  const church = await prisma.church.create({
    data: {
      name: churchName,
      accounts: {
        create: DEFAULT_ACCOUNTS.map((a, i) => ({
          code: a.code,
          name: a.name,
          type: a.type,
          category: a.category ?? null,
          isOffering: a.isOffering ?? false,
          deductible: a.deductible ?? true,
          sortOrder: i,
        })),
      },
    },
  });

  const user = await prisma.user.create({
    data: {
      loginId,
      name,
      phone,
      password: await hashPassword(password),
      role: "ADMIN",
      status: "ACTIVE",
      churchId: church.id,
      approvedAt: new Date(),
    },
  });

  await logAudit({
    churchId: church.id,
    action: "CREATE",
    entity: "Church",
    entityId: church.id,
    summary: `교회 등록: ${church.name}`,
    userId: user.id,
  });

  await createSession({
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    role: "ADMIN",
    status: "ACTIVE",
    churchId: church.id,
    churchName: church.name,
    memberId: null,
  });

  redirect("/dashboard?welcome=1");
}

/* ── 회원가입 (기존 교회에 신청) ─────────── */

export type SignupState = { error?: string };

export async function signup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const churchId = str(formData.get("churchId"));
  const name = str(formData.get("name"));
  const loginId = str(formData.get("loginId"));
  const password = String(formData.get("password") ?? "");
  const phone = str(formData.get("phone"));

  if (!churchId) return { error: "교회를 선택해 주세요." };
  if (!name) return { error: "이름을 입력해 주세요." };
  if (!loginId || loginId.length < 4) {
    return { error: "아이디는 4자 이상으로 정해 주세요." };
  }
  if (password.length < 8) {
    return { error: "비밀번호는 8자 이상으로 정해 주세요." };
  }

  const church = await prisma.church.findUnique({ where: { id: churchId } });
  if (!church) return { error: "선택한 교회를 찾을 수 없습니다." };
  if (!church.joinOpen) {
    return { error: "이 교회는 현재 온라인 가입을 받지 않습니다. 교회 사무실에 문의해 주세요." };
  }
  if (await prisma.user.findUnique({ where: { loginId } })) {
    return { error: "이미 사용 중인 아이디입니다. 다른 아이디를 써 주세요." };
  }

  const user = await prisma.user.create({
    data: {
      loginId,
      name,
      phone,
      password: await hashPassword(password),
      role: "MEMBER",
      status: "PENDING", // 관리자가 승인해야 사용할 수 있다
      churchId: church.id,
    },
  });

  await logAudit({
    churchId: church.id,
    action: "REQUEST",
    entity: "User",
    entityId: user.id,
    summary: `가입 신청: ${user.name}(${user.loginId})`,
    userId: user.id,
  });

  await notifyRoles(church.id, ["ADMIN"], {
    title: "새 가입 신청이 있습니다",
    body: `${user.name}님이 가입을 신청했습니다. 권한을 정해 승인해 주세요.`,
    url: "/settings",
    tag: "signup-request",
  });

  await createSession({
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    role: "MEMBER",
    status: "PENDING",
    churchId: church.id,
    churchName: church.name,
    memberId: null,
  });

  redirect("/pending");
}

/* ── 관리자: 가입 신청 승인 · 거절 ───────── */

/**
 * 가입 신청을 승인하면서 앱 사용 범위(권한)를 정해 준다.
 * 교적과 연결하면 그 사람의 헌금 내역과 기부금영수증이 바로 이어진다.
 */
export async function approveUser(userId: string, formData: FormData) {
  const admin = await requireAdmin();

  const role = (str(formData.get("role")) ?? "MEMBER") as Role;
  const memberId = str(formData.get("memberId"));
  const createMember = formData.get("createMember") === "1";

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.churchId !== admin.churchId) {
    redirect("/settings?error=not-found");
  }

  let linkedMemberId = target.memberId;

  if (memberId) {
    // 이미 있는 교적에 연결한다. 다른 교회 교적이 섞이지 않도록 확인한다.
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { user: true },
    });
    if (!member || member.churchId !== admin.churchId) {
      redirect("/settings?error=not-found");
    }
    if (member.user && member.user.id !== userId) {
      redirect("/settings?error=member-taken");
    }
    linkedMemberId = memberId;
  } else if (createMember && !linkedMemberId) {
    // 교적이 없으면 새로 만들어 준다.
    const last = await prisma.member.findFirst({
      where: { churchId: admin.churchId },
      select: { code: true },
      orderBy: { code: "desc" },
    });
    const next = Number(last?.code ?? 0) + 1;

    const created = await prisma.member.create({
      data: {
        churchId: admin.churchId,
        code: String(Number.isFinite(next) ? next : 1).padStart(4, "0"),
        name: target.name,
        phone: target.phone,
        registeredAt: new Date(),
      },
    });
    linkedMemberId = created.id;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      role,
      status: "ACTIVE",
      memberId: linkedMemberId,
      approvedAt: new Date(),
      approvedById: admin.id,
      rejectReason: null,
    },
  });

  await logAudit({
    churchId: admin.churchId,
    action: "APPROVE",
    entity: "User",
    entityId: userId,
    summary: `가입 승인: ${target.name} → ${ROLES[role]}`,
    userId: admin.id,
  });

  await notifyUser(userId, {
    title: "가입이 승인되었습니다",
    body: `${admin.churchName}에서 가입을 승인했습니다. 이제 이용하실 수 있습니다.`,
    url: role === "MEMBER" ? "/my" : "/dashboard",
    tag: "signup-approved",
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings?ok=approved");
}

export async function rejectUser(userId: string, formData: FormData) {
  const admin = await requireAdmin();

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.churchId !== admin.churchId) {
    redirect("/settings?error=not-found");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: "REJECTED", rejectReason: str(formData.get("reason")) },
  });

  await logAudit({
    churchId: admin.churchId,
    action: "REJECT",
    entity: "User",
    entityId: userId,
    summary: `가입 거절: ${target.name}`,
    userId: admin.id,
  });

  revalidatePath("/settings");
  redirect("/settings?ok=rejected");
}
