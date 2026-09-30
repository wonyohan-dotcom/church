"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/church";
import { SERVICES, type Service } from "@/lib/constants";
import { parseDate, parseIntOr, str, ymdDash } from "@/lib/format";
import { dayRange } from "@/lib/attendance";

function readService(v: FormDataEntryValue | null): Service {
  return typeof v === "string" && v in SERVICES ? (v as Service) : "SUNDAY";
}

/** 출석부 저장. 체크한 교인 목록을 통째로 받아 그 예배의 출석부를 새로 쓴다. */
export async function saveAttendance(formData: FormData) {
  const user = await requireStaff();
  const date = parseDate(formData.get("date"));
  const service = readService(formData.get("service"));
  if (!date) redirect("/attendance/check?error=date");

  const picked = String(formData.get("memberIds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // 다른 교회 교인 ID 가 섞여 들어와도 걸러낸다.
  const members = picked.length
    ? await prisma.member.findMany({
        where: { churchId: user.churchId, id: { in: picked } },
        select: { id: true },
      })
    : [];
  const visitorCount = Math.max(0, Math.min(9999, parseIntOr(formData.get("visitorCount"))));

  const record = await prisma.$transaction(async (tx) => {
    const note = str(formData.get("note"));
    const existing = await tx.attendanceRecord.findFirst({
      where: { churchId: user.churchId, service, date: dayRange(date) },
      select: { id: true },
    });
    const rec = existing
      ? await tx.attendanceRecord.update({ where: { id: existing.id }, data: { visitorCount, note } })
      : await tx.attendanceRecord.create({
          data: { churchId: user.churchId, date, service, visitorCount, note },
        });
    await tx.attendanceCheck.deleteMany({ where: { recordId: rec.id } });
    if (members.length) {
      await tx.attendanceCheck.createMany({
        data: members.map((m) => ({ recordId: rec.id, memberId: m.id })),
      });
    }
    return rec;
  });

  await logAudit({
    churchId: user.churchId,
    action: "UPDATE",
    entity: "Attendance",
    entityId: record.id,
    summary: `출석 저장: ${ymdDash(date)} ${SERVICES[service]} ${members.length}명 + 방문 ${visitorCount}명`,
    userId: user.id,
  });

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  redirect(`/attendance/check?date=${ymdDash(date)}&service=${service}&ok=saved`);
}

export async function deleteAttendance(id: string) {
  const user = await requireStaff();
  await prisma.attendanceRecord.deleteMany({ where: { id, churchId: user.churchId } });
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  redirect("/attendance?ok=deleted");
}
