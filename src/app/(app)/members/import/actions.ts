"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/church";
import { parseDate } from "@/lib/format";

// 브라우저에서 만든 미리보기 줄을 그대로 믿지 않고 여기서 다시 검사한다.
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const text = (max: number) => z.string().max(max).nullable();
const Row = z.object({
  line: z.number().int(),
  name: z.string().min(1).max(30),
  gender: z.enum(["M", "F"]).nullable(),
  birthDate: day,
  birthIsLunar: z.boolean(),
  phone: text(40),
  email: text(200),
  postalCode: text(10),
  address: text(300),
  addressDetail: text(300),
  position: text(30),
  district: text(50),
  status: z.enum(["ACTIVE", "INACTIVE", "TRANSFERRED", "DECEASED"]),
  registeredAt: day,
  catechumenAt: day,
  baptizedAt: day,
  confirmedAt: day,
  job: text(100),
  note: text(500),
});

export type ImportResult = { created: number; skipped: { line: number; reason: string }[] };

const digits = (v: string | null) => (v ?? "").replace(/\D/g, "");

/**
 * 교인 여러 명을 한 번에 등록한다. (한 번에 최대 500명, 화면에서 나눠 보낸다)
 * 이름이 같고 휴대폰이나 생년월일도 같은 교인이 이미 있으면 같은 사람으로 보고 건너뛴다.
 * 교구·구역 이름이 처음 보는 것이면 새로 만든다.
 */
export async function importMembers(input: unknown): Promise<ImportResult> {
  const user = await requireStaff();
  const rows = z.array(Row).max(500).parse(input);
  const result: ImportResult = { created: 0, skipped: [] };
  if (rows.length === 0) return result;

  const existing = await prisma.member.findMany({
    where: { churchId: user.churchId },
    select: { name: true, phone: true, birthDate: true },
  });
  const seen = new Set<string>();
  for (const m of existing) {
    if (m.phone) seen.add(`${m.name}|p${digits(m.phone)}`);
    if (m.birthDate) seen.add(`${m.name}|b${m.birthDate.toDateString()}`);
  }

  // 교구·구역: 이름으로 찾고 없으면 만든다.
  const districts = await prisma.district.findMany({
    where: { churchId: user.churchId },
    select: { id: true, name: true, sortOrder: true },
  });
  const districtId = new Map(districts.map((d) => [d.name, d.id]));
  let order = Math.max(0, ...districts.map((d) => d.sortOrder));
  for (const name of new Set(rows.map((r) => r.district).filter((v): v is string => !!v))) {
    if (districtId.has(name)) continue;
    const d = await prisma.district.create({
      data: { churchId: user.churchId, name, sortOrder: ++order },
    });
    districtId.set(name, d.id);
  }

  const last = await prisma.member.findFirst({
    where: { churchId: user.churchId },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let code = Number(last?.code ?? 0) || 0;

  const data = [];
  for (const r of rows) {
    const birth = parseDate(r.birthDate);
    const keys = [
      r.phone ? `${r.name}|p${digits(r.phone)}` : null,
      birth ? `${r.name}|b${birth.toDateString()}` : null,
    ].filter((k): k is string => !!k);
    if (keys.some((k) => seen.has(k))) {
      result.skipped.push({ line: r.line, reason: "이미 등록된 교인" });
      continue;
    }
    keys.forEach((k) => seen.add(k));
    data.push({
      churchId: user.churchId,
      code: String(++code).padStart(4, "0"),
      name: r.name,
      gender: r.gender,
      birthDate: birth,
      birthIsLunar: r.birthIsLunar,
      phone: r.phone,
      email: r.email,
      postalCode: r.postalCode,
      address: r.address,
      addressDetail: r.addressDetail,
      position: r.position,
      districtId: r.district ? (districtId.get(r.district) ?? null) : null,
      status: r.status,
      registeredAt: parseDate(r.registeredAt),
      catechumenAt: parseDate(r.catechumenAt),
      baptizedAt: parseDate(r.baptizedAt),
      confirmedAt: parseDate(r.confirmedAt),
      job: r.job,
      note: r.note,
    });
  }

  if (data.length) {
    await prisma.member.createMany({ data });
    result.created = data.length;
    await logAudit({
      churchId: user.churchId,
      action: "CREATE",
      entity: "Member",
      summary: `엑셀로 교인 ${data.length}명 등록`,
      userId: user.id,
    });
    revalidatePath("/members");
    revalidatePath("/dashboard");
  }
  return result;
}
