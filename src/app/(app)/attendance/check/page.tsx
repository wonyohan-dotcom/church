import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { findRecord, lastSunday } from "@/lib/attendance";
import { SERVICES, type Service } from "@/lib/constants";
import { parseDate, ymdDash } from "@/lib/format";
import { Alert, PageHeader } from "@/components/ui";
import { AttendanceSheet } from "./attendance-sheet";
import { saveAttendance } from "../actions";

export const metadata = { title: "출석 체크" };

export default async function AttendanceCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; service?: string; ok?: string; error?: string }>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;

  const service: Service = sp.service && sp.service in SERVICES ? (sp.service as Service) : "SUNDAY";
  // 주일예배는 가장 가까운 지난 주일, 나머지는 오늘을 기본으로 연다.
  const date =
    parseDate(sp.date ?? null) ?? (service === "SUNDAY" ? lastSunday() : parseDate(ymdDash(new Date()))!);

  const [members, record] = await Promise.all([
    prisma.member.findMany({
      where: { churchId: staff.churchId, status: { in: ["ACTIVE", "INACTIVE"] } },
      select: {
        id: true,
        name: true,
        position: true,
        status: true,
        photoUrl: true,
        district: { select: { id: true, name: true, sortOrder: true } },
      },
      orderBy: [{ name: "asc" }],
    }),
    findRecord(staff.churchId, date, service),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="출석"
        title="출석 체크"
        description="나온 분은 이름을 눌러 표시하세요. 못 온 분은 ⋯ 를 눌러 사유(아파서 등)를 남기고, 처음 온 분은 이름을 적을 수 있습니다."
        back={{ href: "/attendance", label: "출석 현황" }}
      />

      {sp.ok === "saved" && (
        <div className="mb-5">
          <Alert tone="income">저장했습니다.</Alert>
        </div>
      )}

      <AttendanceSheet
        key={`${ymdDash(date)}-${service}`}
        action={saveAttendance}
        date={ymdDash(date)}
        service={service}
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          position: m.position,
          inactive: m.status === "INACTIVE",
          district: m.district?.name ?? null,
          districtOrder: m.district?.sortOrder ?? 9999,
        }))}
        initialChecked={record?.checks.map((c) => c.memberId) ?? []}
        initialAbsences={record?.absences.map((a) => ({ memberId: a.memberId, reason: a.reason, note: a.note ?? "" })) ?? []}
        initialVisitorList={record?.visitors.map((v) => ({ name: v.name, note: v.note ?? "" })) ?? []}
        initialUnnamed={Math.max(0, (record?.visitorCount ?? 0) - (record?.visitors.length ?? 0))}
        initialNote={record?.note ?? ""}
        exists={!!record}
      />
    </>
  );
}
