"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/church";
import { deleteImage, saveImage } from "@/lib/upload";
import { str } from "@/lib/format";
import { ROLES, type Role } from "@/lib/constants";

export async function updateChurch(formData: FormData) {
  const admin = await requireAdmin();

  const current = await prisma.churchSetting.findUnique({ where: { id: "singleton" } });

  let logoUrl = current?.logoUrl ?? null;
  let sealUrl = current?.sealUrl ?? null;

  try {
    const logo = await saveImage(formData.get("logo"), "church");
    if (logo) {
      await deleteImage(logoUrl);
      logoUrl = logo;
    } else if (formData.get("logo_remove") === "1") {
      await deleteImage(logoUrl);
      logoUrl = null;
    }

    const seal = await saveImage(formData.get("seal"), "church");
    if (seal) {
      await deleteImage(sealUrl);
      sealUrl = seal;
    } else if (formData.get("seal_remove") === "1") {
      await deleteImage(sealUrl);
      sealUrl = null;
    }
  } catch {
    redirect("/settings?error=image");
  }

  await prisma.churchSetting.upsert({
    where: { id: "singleton" },
    update: {
      name: str(formData.get("name")) ?? "우리교회",
      regNo: str(formData.get("regNo")),
      representative: str(formData.get("representative")),
      postalCode: str(formData.get("postalCode")),
      address: str(formData.get("address")),
      phone: str(formData.get("phone")),
      receiptAutoIssue: formData.get("receiptAutoIssue") === "1",
      logoUrl,
      sealUrl,
    },
    create: {
      id: "singleton",
      name: str(formData.get("name")) ?? "우리교회",
      regNo: str(formData.get("regNo")),
      representative: str(formData.get("representative")),
      postalCode: str(formData.get("postalCode")),
      address: str(formData.get("address")),
      phone: str(formData.get("phone")),
      receiptAutoIssue: formData.get("receiptAutoIssue") === "1",
      logoUrl,
      sealUrl,
    },
  });

  await logAudit({
    action: "UPDATE",
    entity: "ChurchSetting",
    summary: "교회 기본 정보 수정",
    userId: admin.id,
  });

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  redirect("/settings?ok=church");
}

export async function createStaffUser(formData: FormData) {
  const admin = await requireAdmin();

  const loginId = str(formData.get("loginId"));
  const name = str(formData.get("name"));
  const password = String(formData.get("password") ?? "");
  const role = (str(formData.get("role")) ?? "PASTOR") as Role;

  if (!loginId || !name || password.length < 8 || !(role in ROLES)) {
    redirect("/settings?error=user-input");
  }

  if (await prisma.user.findUnique({ where: { loginId } })) {
    redirect("/settings?error=user-duplicate");
  }

  await prisma.user.create({
    data: { loginId, name, password: await hashPassword(password), role },
  });

  await logAudit({
    action: "CREATE",
    entity: "User",
    summary: `직원 계정 생성: ${name}(${loginId}) · ${ROLES[role]}`,
    userId: admin.id,
  });

  revalidatePath("/settings");
  redirect("/settings?ok=user-created");
}

export async function toggleUserActive(id: string) {
  const admin = await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return;

  // 자기 계정을 스스로 잠그면 아무도 관리할 수 없게 된다.
  if (user.id === admin.id) redirect("/settings?error=self");

  await prisma.user.update({ where: { id }, data: { active: !user.active } });

  await logAudit({
    action: "UPDATE",
    entity: "User",
    entityId: id,
    summary: `계정 ${user.active ? "잠금" : "해제"}: ${user.name}`,
    userId: admin.id,
  });

  revalidatePath("/settings");
}

export async function changeUserRole(id: string, formData: FormData) {
  const admin = await requireAdmin();

  const role = (str(formData.get("role")) ?? "") as Role;
  if (!(role in ROLES)) return;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return;

  // 마지막 관리자의 권한을 낮추면 관리 화면에 들어갈 사람이 사라진다.
  if (user.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (adminCount <= 1) redirect("/settings?error=last-admin");
  }

  await prisma.user.update({ where: { id }, data: { role } });

  await logAudit({
    action: "UPDATE",
    entity: "User",
    entityId: id,
    summary: `권한 변경: ${user.name} → ${ROLES[role]}`,
    userId: admin.id,
  });

  revalidatePath("/settings");
}

export async function resetUserPassword(id: string, formData: FormData) {
  const admin = await requireAdmin();

  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect("/settings?error=user-input");

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return;

  await prisma.user.update({
    where: { id },
    data: { password: await hashPassword(password), mustChangePw: true },
  });

  await logAudit({
    action: "UPDATE",
    entity: "User",
    entityId: id,
    summary: `비밀번호 재설정: ${user.name}`,
    userId: admin.id,
  });

  revalidatePath("/settings");
  redirect("/settings?ok=password-reset");
}
