"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/church";
import { ABSENCE_REASONS, SERVICES, type Service } from "@/lib/constants";
import { parseDate, parseIntOr, str, ymdDash } from "@/lib/format";
import { dayRange } from "@/lib/attendance";

function readJson<T>(v: FormDataEntryValue | null): T extends Array<unknown> ? T : T {
  try {
    const parsed = JSON.parse(typeof v === "string" ? v : "[]");
    return (Array.isArray(parsed) ? parsed : []) as never;
  } catch {
    return [] as never;
  }
}

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
  const presentIds = new Set(members.map((m) => m.id));

  // 사유가 있는 결석 (예: 아파서). 출석으로 표시된 분은 제외한다.
  const absenceIn = readJson<Array<{ memberId?: string; reason?: string; note?: string }>>(formData.get("absences"));
  const absenceMembers = absenceIn.length
    ? await prisma.member.findMany({
        where: { churchId: user.churchId, id: { in: absenceIn.map((a) => String(a.memberId ?? "")) } },
        select: { id: true },
      })
    : [];
  const absentOk = new Set(absenceMembers.map((m) => m.id));
  const absences = absenceIn
    .filter((a) => a.memberId && absentOk.has(a.memberId) && !presentIds.has(a.memberId))
    .slice(0, 300)
    .map((a) => ({
      memberId: a.memberId!,
      reason: (ABSENCE_REASONS as readonly string[]).includes(a.reason ?? "") ? a.reason! : "기타",
      note: (a.note ?? "").trim().slice(0, 100) || null,
    }));

  // 교적에 없는 방문자·새가족: 이름이 있는 분은 목록으로, 이름 없이 인원만 센 분은 숫자로 더한다.
  const visitors = readJson<Array<{ name?: string; note?: string }>>(formData.get("visitors"))
    .map((v) => ({ name: (v.name ?? "").trim().slice(0, 40), note: (v.note ?? "").trim().slice(0, 200) || null }))
    .filter((v) => v.name)
    .slice(0, 100);
  const unnamed = Math.max(0, Math.min(9999, parseIntOr(formData.get("visitorCount"))));
  const visitorCount = Math.min(9999, unnamed + visitors.length);

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
    await tx.attendanceAbsence.deleteMany({ where: { recordId: rec.id } });
    await tx.attendanceVisitor.deleteMany({ where: { recordId: rec.id } });
    if (absences.length) await tx.attendanceAbsence.createMany({ data: absences.map((a) => ({ ...a, recordId: rec.id })) });
    if (visitors.length) await tx.attendanceVisitor.createMany({ data: visitors.map((v) => ({ ...v, recordId: rec.id })) });
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
    summary: `출석 저장: ${ymdDash(date)} ${SERVICES[service]} ${members.length}명 + 방문 ${visitorCount}명 · 사유 결석 ${absences.length}명`,
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
