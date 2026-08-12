"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, requireUser, requireStaff } from "@/lib/auth";
import { getChurch, logAudit } from "@/lib/church";
import { getMemberYearOfferings } from "@/lib/finance";
import { encryptSensitive, normalizeRegNo } from "@/lib/crypto";
import { STAFF_ROLES } from "@/lib/constants";
import { str } from "@/lib/format";

/** 연도별 일련번호. 예: 2026-0001 */
async function nextReceiptNo(churchId: string, year: number): Promise<string> {
  const count = await prisma.donationReceipt.count({ where: { churchId, year } });
  return `${year}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * 해당 교인·연도의 헌금을 다시 집계해 영수증 명세를 채운다.
 * 발급 시점의 장부를 그대로 옮겨 담으므로, 나중에 헌금이 수정되면 재발급이 필요하다.
 */
async function fillReceiptItems(receiptId: string, memberId: string, year: number) {
  const { items, deductibleTotal } = await getMemberYearOfferings(memberId, year);
  const deductible = items.filter((i) => i.deductible);

  await prisma.$transaction([
    prisma.donationReceiptItem.deleteMany({ where: { receiptId } }),
    prisma.donationReceiptItem.createMany({
      data: deductible.map((i) => ({
        receiptId,
        accountName: i.accountName,
        amount: i.amount,
        count: i.count,
      })),
    }),
    prisma.donationReceipt.update({
      where: { id: receiptId },
      data: { totalAmount: deductibleTotal },
    }),
  ]);

  return deductibleTotal;
}

/* ── 성도: 신청 ──────────────────────────── */

export async function requestReceipt(formData: FormData) {
  const user = await requireUser();
  if (!user.memberId) redirect("/my?error=no-member");

  const year = Number(formData.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear()) {
    redirect("/my/receipts?error=year");
  }

  const regNoRaw = String(formData.get("regNo") ?? "");
  const regNo = normalizeRegNo(regNoRaw);
  if (!regNo) redirect("/my/receipts?error=regno");

  // 주소 검색으로 채운 도로명 주소와 직접 적은 상세 주소를 한 줄로 합친다.
  const address = [str(formData.get("address")), str(formData.get("addressDetail"))]
    .filter(Boolean)
    .join(" ");
  if (!address) redirect("/my/receipts?error=address");

  const member = await prisma.member.findUnique({ where: { id: user.memberId } });
  if (!member) redirect("/my?error=no-member");

  const existing = await prisma.donationReceipt.findUnique({
    where: { memberId_year: { memberId: member.id, year } },
  });
  if (existing && existing.status !== "CANCELED") {
    redirect(`/my/receipts?error=duplicate&year=${year}`);
  }

  const { deductibleTotal } = await getMemberYearOfferings(member.id, year);
  if (deductibleTotal <= 0) {
    redirect(`/my/receipts?error=no-offering&year=${year}`);
  }

  const church = await getChurch(member.churchId);
  const autoIssue = church.receiptAutoIssue;

  const receipt = existing
    ? await prisma.donationReceipt.update({
        where: { id: existing.id },
        data: {
          status: autoIssue ? "ISSUED" : "REQUESTED",
          requestedAt: new Date(),
          issuedAt: autoIssue ? new Date() : null,
          donorName: member.name,
          donorRegNoEnc: encryptSensitive(regNo),
          donorAddress: address,
          donorPhone: str(formData.get("phone")) ?? member.phone,
          rejectReason: null,
        },
      })
    : await prisma.donationReceipt.create({
        data: {
          churchId: member.churchId,
          receiptNo: await nextReceiptNo(member.churchId, year),
          year,
          memberId: member.id,
          donorName: member.name,
          donorRegNoEnc: encryptSensitive(regNo),
          donorAddress: address,
          donorPhone: str(formData.get("phone")) ?? member.phone,
          status: autoIssue ? "ISSUED" : "REQUESTED",
          issuedAt: autoIssue ? new Date() : null,
        },
      });

  await fillReceiptItems(receipt.id, member.id, year);

  await logAudit({
    churchId: member.churchId,
    action: autoIssue ? "ISSUE" : "REQUEST",
    entity: "DonationReceipt",
    entityId: receipt.id,
    summary: `${year}년 기부금영수증 ${autoIssue ? "자동발급" : "신청"}: ${member.name}`,
    userId: user.id,
  });

  revalidatePath("/my/receipts");
  revalidatePath("/receipts");

  // 자동발급이면 곧바로 영수증을 열어 준다.
  redirect(autoIssue ? `/my/receipts/${receipt.id}?ok=issued` : "/my/receipts?ok=requested");
}

/** 성도가 본인 신청을 취소한다. */
export async function cancelReceipt(id: string) {
  const user = await requireUser();

  const receipt = await prisma.donationReceipt.findUnique({ where: { id } });
  if (!receipt || receipt.churchId !== user.churchId) redirect("/my/receipts");

  const isOwner = receipt.memberId === user.memberId;
  const isStaff = STAFF_ROLES.includes(user.role);
  if (!isOwner && !isStaff) redirect("/my/receipts");

  // 이미 발급된 영수증은 성도가 스스로 취소할 수 없다.
  if (receipt.status === "ISSUED" && !isStaff) {
    redirect("/my/receipts?error=already-issued");
  }

  await prisma.donationReceipt.update({
    where: { id },
    data: { status: "CANCELED" },
  });

  await logAudit({
    churchId: receipt.churchId,
    action: "CANCEL",
    entity: "DonationReceipt",
    entityId: id,
    summary: `${receipt.year}년 기부금영수증 취소: ${receipt.donorName}`,
    userId: user.id,
  });

  revalidatePath("/my/receipts");
  revalidatePath("/receipts");
  redirect(isStaff ? "/receipts?ok=canceled" : "/my/receipts?ok=canceled");
}

/* ── 교회: 발급 · 반려 ───────────────────── */

export async function issueReceipt(id: string) {
  const staff = await requireStaff();

  const receipt = await prisma.donationReceipt.findUnique({ where: { id } });
  if (!receipt || receipt.churchId !== staff.churchId) redirect("/receipts");

  // 발급 직전에 장부를 다시 읽어 최신 금액으로 맞춘다.
  const total = await fillReceiptItems(receipt.id, receipt.memberId, receipt.year);

  await prisma.donationReceipt.update({
    where: { id },
    data: {
      status: "ISSUED",
      issuedAt: new Date(),
      issuedById: staff.id,
      rejectReason: null,
    },
  });

  await logAudit({
    churchId: staff.churchId,
    action: "ISSUE",
    entity: "DonationReceipt",
    entityId: id,
    summary: `${receipt.year}년 기부금영수증 발급: ${receipt.donorName} (${total.toLocaleString("ko-KR")}원)`,
    userId: staff.id,
  });

  revalidatePath("/receipts");
  revalidatePath("/my/receipts");
  redirect(`/receipts/${id}?ok=issued`);
}

export async function rejectReceipt(id: string, formData: FormData) {
  const staff = await requireStaff();

  const reason = str(formData.get("reason"));
  const receipt = await prisma.donationReceipt.findUnique({ where: { id } });
  if (!receipt || receipt.churchId !== staff.churchId) redirect("/receipts");

  await prisma.donationReceipt.update({
    where: { id },
    data: { status: "REJECTED", rejectReason: reason },
  });

  await logAudit({
    churchId: staff.churchId,
    action: "REJECT",
    entity: "DonationReceipt",
    entityId: id,
    summary: `${receipt.year}년 기부금영수증 반려: ${receipt.donorName}`,
    userId: staff.id,
  });

  revalidatePath("/receipts");
  revalidatePath("/my/receipts");
  redirect("/receipts?ok=rejected");
}

/**
 * 교회가 성도를 대신해 영수증을 만들어 발급한다.
 * (온라인 신청이 어려운 어르신 성도를 위해 필요하다)
 */
export async function issueReceiptForMember(formData: FormData) {
  const staff = await requireStaff();

  const memberId = str(formData.get("memberId"));
  const year = Number(formData.get("year"));
  if (!memberId || !Number.isInteger(year)) redirect("/receipts?error=input");

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member || member.churchId !== staff.churchId) redirect("/receipts?error=input");

  const { deductibleTotal } = await getMemberYearOfferings(memberId, year);
  if (deductibleTotal <= 0) redirect("/receipts?error=no-offering");

  const regNo = normalizeRegNo(String(formData.get("regNo") ?? ""));

  const existing = await prisma.donationReceipt.findUnique({
    where: { memberId_year: { memberId, year } },
  });

  const receipt = existing
    ? await prisma.donationReceipt.update({
        where: { id: existing.id },
        data: {
          status: "ISSUED",
          issuedAt: new Date(),
          issuedById: staff.id,
          donorName: member.name,
          donorAddress: str(formData.get("address")) ?? member.address,
          donorPhone: member.phone,
          ...(regNo ? { donorRegNoEnc: encryptSensitive(regNo) } : {}),
        },
      })
    : await prisma.donationReceipt.create({
        data: {
          churchId: staff.churchId,
          receiptNo: await nextReceiptNo(staff.churchId, year),
          year,
          memberId,
          donorName: member.name,
          donorAddress: str(formData.get("address")) ?? member.address,
          donorPhone: member.phone,
          donorRegNoEnc: regNo ? encryptSensitive(regNo) : null,
          status: "ISSUED",
          issuedAt: new Date(),
          issuedById: staff.id,
        },
      });

  await fillReceiptItems(receipt.id, memberId, year);

  await logAudit({
    churchId: staff.churchId,
    action: "ISSUE",
    entity: "DonationReceipt",
    entityId: receipt.id,
    summary: `${year}년 기부금영수증 직접 발급: ${member.name}`,
    userId: staff.id,
  });

  revalidatePath("/receipts");
  redirect(`/receipts/${receipt.id}?ok=issued`);
}

/** 발급된 영수증의 금액을 최신 장부로 다시 맞춘다. */
export async function refreshReceipt(id: string) {
  const staff = await requireStaff();
  const receipt = await prisma.donationReceipt.findUnique({ where: { id } });
  if (!receipt || receipt.churchId !== staff.churchId) redirect("/receipts");

  await fillReceiptItems(receipt.id, receipt.memberId, receipt.year);

  await logAudit({
    churchId: staff.churchId,
    action: "UPDATE",
    entity: "DonationReceipt",
    entityId: id,
    summary: `${receipt.year}년 기부금영수증 금액 재계산: ${receipt.donorName}`,
    userId: staff.id,
  });

  revalidatePath(`/receipts/${id}`);
  redirect(`/receipts/${id}?ok=refreshed`);
}

/** 로그인한 사람이 이 영수증을 볼 수 있는지 확인한다. */
export async function canViewReceipt(receiptMemberId: string) {
  const user = await getSession();
  if (!user) return false;
  if (STAFF_ROLES.includes(user.role)) return true;
  return user.memberId === receiptMemberId;
}
