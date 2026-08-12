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

  const current = await prisma.church.findUnique({ where: { id: admin.churchId } });

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

  // 교회 주소는 한 칸에 담기므로 상세 주소를 뒤에 붙여 둔다.
  const address = [str(formData.get("address")), str(formData.get("addressDetail"))]
    .filter(Boolean)
    .join(" ");

  await prisma.church.update({
    where: { id: admin.churchId },
    data: {
      name: str(formData.get("name")) ?? "우리교회",
      regNo: str(formData.get("regNo")),
      representative: str(formData.get("representative")),
      postalCode: str(formData.get("postalCode")),
      address: address || null,
      phone: str(formData.get("phone")),
      receiptAutoIssue: formData.get("receiptAutoIssue") === "1",
      joinOpen: formData.get("joinOpen") === "1",
      logoUrl,
      sealUrl,
    },
  });

  await logAudit({
    churchId: admin.churchId,
    action: "UPDATE",
    entity: "Church",
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
    data: {
      loginId,
      name,
      password: await hashPassword(password),
      role,
      status: "ACTIVE",
      churchId: admin.churchId,
      approvedAt: new Date(),
      approvedById: admin.id,
    },
  });

  await logAudit({
    churchId: admin.churchId,
    action: "CREATE",
    entity: "User",
    summary: `직원 계정 생성: ${name}(${loginId}) · ${ROLES[role]}`,
    userId: admin.id,
  });

  revalidatePath("/settings");
  redirect("/settings?ok=user-created");
}

/** 계정 사용을 막거나 다시 풀어 준다. */
export async function toggleUserActive(id: string) {
  const admin = await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.churchId !== admin.churchId) return;

  // 자기 계정을 스스로 잠그면 아무도 관리할 수 없게 된다.
  if (user.id === admin.id) redirect("/settings?error=self");

  const suspended = user.status === "SUSPENDED";
  await prisma.user.update({
    where: { id },
    data: { status: suspended ? "ACTIVE" : "SUSPENDED" },
  });

  await logAudit({
    churchId: admin.churchId,
    action: "UPDATE",
    entity: "User",
    entityId: id,
    summary: `계정 ${suspended ? "사용 재개" : "정지"}: ${user.name}`,
    userId: admin.id,
  });

  revalidatePath("/settings");
}

/** 앱 사용 범위(권한)를 바꾼다. */
export async function changeUserRole(id: string, formData: FormData) {
  const admin = await requireAdmin();

  const role = (str(formData.get("role")) ?? "") as Role;
  if (!(role in ROLES)) return;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.churchId !== admin.churchId) return;

  // 마지막 관리자의 권한을 낮추면 관리 화면에 들어갈 사람이 사라진다.
  if (user.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { churchId: admin.churchId, role: "ADMIN", status: "ACTIVE" },
    });
    if (adminCount <= 1) redirect("/settings?error=last-admin");
  }

  await prisma.user.update({ where: { id }, data: { role } });

  await logAudit({
    churchId: admin.churchId,
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
  if (!user || user.churchId !== admin.churchId) return;

  await prisma.user.update({
    where: { id },
    data: { password: await hashPassword(password), mustChangePw: true },
  });

  await logAudit({
    churchId: admin.churchId,
    action: "UPDATE",
    entity: "User",
    entityId: id,
    summary: `비밀번호 재설정: ${user.name}`,
    userId: admin.id,
  });

  revalidatePath("/settings");
  redirect("/settings?ok=password-reset");
}
