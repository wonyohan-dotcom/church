"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/church";
import { deleteImage, saveImage } from "@/lib/upload";
import { parseDate, str } from "@/lib/format";

/** 비어 있지 않은 다음 교적번호를 만든다. (예: 0001, 0002 …) */
async function nextMemberCode(): Promise<string> {
  const rows = await prisma.member.findMany({
    select: { code: true },
    orderBy: { code: "desc" },
    take: 1,
  });
  const last = Number(rows[0]?.code ?? 0);
  const next = Number.isFinite(last) ? last + 1 : 1;
  return String(next).padStart(4, "0");
}

function readMemberForm(formData: FormData) {
  return {
    name: str(formData.get("name")) ?? "",
    nameHanja: str(formData.get("nameHanja")),
    gender: str(formData.get("gender")),
    birthDate: parseDate(formData.get("birthDate")),
    birthIsLunar: formData.get("birthIsLunar") === "1",
    phone: str(formData.get("phone")),
    email: str(formData.get("email")),
    postalCode: str(formData.get("postalCode")),
    address: str(formData.get("address")),
    addressDetail: str(formData.get("addressDetail")),
    householdId: str(formData.get("householdId")),
    householdRel: str(formData.get("householdRel")),
    districtId: str(formData.get("districtId")),
    position: str(formData.get("position")),
    status: str(formData.get("status")) ?? "ACTIVE",
    registeredAt: parseDate(formData.get("registeredAt")),
    catechumenAt: parseDate(formData.get("catechumenAt")),
    baptizedAt: parseDate(formData.get("baptizedAt")),
    confirmedAt: parseDate(formData.get("confirmedAt")),
    transferredAt: parseDate(formData.get("transferredAt")),
    transferTo: str(formData.get("transferTo")),
    deceasedAt: parseDate(formData.get("deceasedAt")),
    job: str(formData.get("job")),
    previousChurch: str(formData.get("previousChurch")),
    note: str(formData.get("note")),
  };
}

export async function createMember(formData: FormData) {
  const user = await requireStaff();
  const data = readMemberForm(formData);

  if (!data.name) redirect("/members/new?error=name");

  let photoUrl: string | null = null;
  try {
    photoUrl = await saveImage(formData.get("photo"), "members");
  } catch {
    redirect("/members/new?error=photo");
  }

  const member = await prisma.member.create({
    data: { ...data, code: await nextMemberCode(), photoUrl },
  });

  await logAudit({
    action: "CREATE",
    entity: "Member",
    entityId: member.id,
    summary: `교인 등록: ${member.name}`,
    userId: user.id,
  });

  revalidatePath("/members");
  redirect(`/members/${member.id}`);
}

export async function updateMember(id: string, formData: FormData) {
  const user = await requireStaff();
  const data = readMemberForm(formData);

  if (!data.name) redirect(`/members/${id}/edit?error=name`);

  const current = await prisma.member.findUnique({ where: { id } });
  if (!current) redirect("/members");

  let photoUrl = current.photoUrl;
  try {
    const uploaded = await saveImage(formData.get("photo"), "members");
    if (uploaded) {
      await deleteImage(current.photoUrl);
      photoUrl = uploaded;
    } else if (formData.get("photo_remove") === "1") {
      await deleteImage(current.photoUrl);
      photoUrl = null;
    }
  } catch {
    redirect(`/members/${id}/edit?error=photo`);
  }

  await prisma.member.update({ where: { id }, data: { ...data, photoUrl } });

  await logAudit({
    action: "UPDATE",
    entity: "Member",
    entityId: id,
    summary: `교인 수정: ${data.name}`,
    userId: user.id,
  });

  revalidatePath("/members");
  revalidatePath(`/members/${id}`);
  redirect(`/members/${id}`);
}

export async function deleteMember(id: string) {
  const user = await requireStaff();

  const member = await prisma.member.findUnique({
    where: { id },
    select: { name: true, photoUrl: true, _count: { select: { offerings: true } } },
  });
  if (!member) redirect("/members");

  // 헌금 기록이 남아 있으면 회계 이력이 끊기므로 지우지 않고 '소천/이명' 상태로 관리하게 안내한다.
  if (member._count.offerings > 0) {
    redirect(`/members/${id}?error=has-offerings`);
  }

  await prisma.member.delete({ where: { id } });
  await deleteImage(member.photoUrl);

  await logAudit({
    action: "DELETE",
    entity: "Member",
    entityId: id,
    summary: `교인 삭제: ${member.name}`,
    userId: user.id,
  });

  revalidatePath("/members");
  redirect("/members");
}

/* ── 성도 로그인 계정 ────────────────────── */

/**
 * 교인에게 성도용 로그인 계정을 만들어 준다.
 * 성도는 이 계정으로 본인 헌금 내역과 기부금영수증만 볼 수 있다.
 */
export async function createMemberAccount(memberId: string, formData: FormData) {
  const admin = await requireStaff();

  const loginId = str(formData.get("loginId"));
  const password = String(formData.get("password") ?? "");

  if (!loginId || password.length < 8) {
    redirect(`/members/${memberId}?error=account-input`);
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) redirect("/members");

  if (await prisma.user.findUnique({ where: { loginId } })) {
    redirect(`/members/${memberId}?error=account-duplicate`);
  }

  await prisma.user.create({
    data: {
      loginId,
      password: await hashPassword(password),
      name: member.name,
      role: "MEMBER",
      memberId,
      mustChangePw: true,
    },
  });

  await logAudit({
    action: "CREATE",
    entity: "User",
    entityId: memberId,
    summary: `성도 계정 발급: ${member.name}(${loginId})`,
    userId: admin.id,
  });

  revalidatePath(`/members/${memberId}`);
  redirect(`/members/${memberId}?ok=account-created`);
}

export async function resetMemberPassword(memberId: string, formData: FormData) {
  const admin = await requireStaff();

  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect(`/members/${memberId}?error=account-input`);

  const user = await prisma.user.findUnique({ where: { memberId } });
  if (!user) redirect(`/members/${memberId}`);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(password), mustChangePw: true, active: true },
  });

  await logAudit({
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    summary: `성도 계정 비밀번호 재설정: ${user.name}`,
    userId: admin.id,
  });

  revalidatePath(`/members/${memberId}`);
  redirect(`/members/${memberId}?ok=password-reset`);
}

/* ── 교구 · 가정 ─────────────────────────── */

export async function createDistrict(formData: FormData) {
  await requireStaff();
  const name = str(formData.get("name"));
  if (!name) return;

  await prisma.district.upsert({
    where: { name },
    update: { leaderName: str(formData.get("leaderName")) },
    create: { name, leaderName: str(formData.get("leaderName")) },
  });

  revalidatePath("/members/groups");
}

export async function deleteDistrict(id: string) {
  await requireStaff();
  await prisma.district.delete({ where: { id } });
  revalidatePath("/members/groups");
}

export async function createHousehold(formData: FormData) {
  await requireStaff();
  const name = str(formData.get("name"));
  if (!name) return;

  await prisma.household.create({
    data: {
      name,
      districtId: str(formData.get("districtId")),
      postalCode: str(formData.get("postalCode")),
      address: str(formData.get("address")),
      addressDetail: str(formData.get("addressDetail")),
      phone: str(formData.get("phone")),
      note: str(formData.get("note")),
    },
  });

  revalidatePath("/members/groups");
}

export async function deleteHousehold(id: string) {
  await requireStaff();
  await prisma.household.delete({ where: { id } });
  revalidatePath("/members/groups");
}
