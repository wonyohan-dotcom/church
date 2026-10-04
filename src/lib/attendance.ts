import { prisma } from "./prisma";
import { ABSENCE_ALERT_WEEKS } from "./constants";

/** 날짜의 시각을 지운다 (출석부는 날짜 단위) */
export function dayOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * 그날 하루 범위. 날짜를 딱 맞춰 비교하지 않고 범위로 찾는다.
 * 서버 시간대가 바뀌기 전(UTC 자정)에 저장된 날짜도 같은 날로 잡히게 하려는 것이다.
 */
export function dayRange(d: Date) {
  const start = dayOnly(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

/** 그 날짜의 출석부 하나 (없으면 null) */
export function findRecord(churchId: string, date: Date, service: string) {
  return prisma.attendanceRecord.findFirst({
    where: { churchId, service, date: dayRange(date) },
    include: {
      checks: { select: { memberId: true } },
      absences: { select: { memberId: true, reason: true, note: true } },
      visitors: { select: { name: true, note: true }, orderBy: { id: "asc" } },
    },
  });
}

/** 그 날짜 또는 그 이전의 가장 가까운 주일 */
export function lastSunday(d = new Date()) {
  const day = dayOnly(d);
  day.setDate(day.getDate() - day.getDay());
  return day;
}

/** 최근 주일예배 출석 추이 (오래된 순). 출석부를 만든 주만 나온다. */
export async function sundayTrend(churchId: string, weeks = 8) {
  const records = await prisma.attendanceRecord.findMany({
    where: { churchId, service: "SUNDAY" },
    orderBy: { date: "desc" },
    take: weeks,
    select: { id: true, date: true, visitorCount: true, _count: { select: { checks: true } } },
  });
  return records
    .map((r) => ({
      id: r.id,
      date: r.date,
      members: r._count.checks,
      visitors: r.visitorCount,
      total: r._count.checks + r.visitorCount,
    }))
    .reverse();
}

export type Absentee = {
  id: string;
  name: string;
  position: string | null;
  photoUrl: string | null;
  phone: string | null;
  districtName: string | null;
  lastSeen: Date | null;
};

/**
 * 최근 주일예배 출석부 N번 연속으로 이름이 없는 재적 교인.
 * 출석부가 N개가 안 되면(기능을 막 쓰기 시작했으면) 아무도 보여주지 않는다.
 * 그 사이에 새로 등록한 교인은 빼고 본다.
 */
export async function findAbsentees(
  churchId: string,
  weeks = ABSENCE_ALERT_WEEKS,
): Promise<Absentee[]> {
  const records = await prisma.attendanceRecord.findMany({
    where: { churchId, service: "SUNDAY" },
    orderBy: { date: "desc" },
    take: weeks,
    select: { id: true, date: true },
  });
  if (records.length < weeks) return [];

  const oldest = records[records.length - 1].date;
  const present = await prisma.attendanceCheck.findMany({
    where: { recordId: { in: records.map((r) => r.id) } },
    select: { memberId: true },
  });
  const seen = new Set(present.map((p) => p.memberId));

  const members = await prisma.member.findMany({
    where: {
      churchId,
      status: "ACTIVE",
      id: { notIn: [...seen] },
      // 출석부를 쓰기 시작한 뒤에 등록한 분은 빼고 본다.
      OR: [
        { registeredAt: { lt: oldest } },
        { registeredAt: null, createdAt: { lt: oldest } },
      ],
    },
    select: {
      id: true,
      name: true,
      position: true,
      photoUrl: true,
      phone: true,
      district: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
  if (members.length === 0) return [];

  // 마지막으로 나온 주일
  const last = await prisma.attendanceCheck.findMany({
    where: { memberId: { in: members.map((m) => m.id) }, record: { service: "SUNDAY" } },
    select: { memberId: true, record: { select: { date: true } } },
  });
  const lastSeen = new Map<string, Date>();
  for (const c of last) {
    const prev = lastSeen.get(c.memberId);
    if (!prev || c.record.date > prev) lastSeen.set(c.memberId, c.record.date);
  }

  return members
    .map((m) => ({
      id: m.id,
      name: m.name,
      position: m.position,
      photoUrl: m.photoUrl,
      phone: m.phone,
      districtName: m.district?.name ?? null,
      lastSeen: lastSeen.get(m.id) ?? null,
    }))
    .sort((a, b) => (a.lastSeen?.getTime() ?? 0) - (b.lastSeen?.getTime() ?? 0));
}

/** 한 교인의 최근 주일 출석 여부 (오래된 순) */
export async function memberSundays(churchId: string, memberId: string, weeks = 12) {
  const records = await prisma.attendanceRecord.findMany({
    where: { churchId, service: "SUNDAY" },
    orderBy: { date: "desc" },
    take: weeks,
    select: { date: true, checks: { where: { memberId }, select: { id: true } } },
  });
  return records.map((r) => ({ date: r.date, present: r.checks.length > 0 })).reverse();
}
