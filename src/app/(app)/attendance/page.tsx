import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff, canPastoral } from "@/lib/auth";
import { findAbsentees, sundayTrend } from "@/lib/attendance";
import { ABSENCE_ALERT_WEEKS, SERVICES, type Service } from "@/lib/constants";
import { phone as fmtPhone, ymd, ymdDash } from "@/lib/format";
import { Alert, Avatar, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { IconCalendarCheck, IconChevronRight, IconPlus } from "@/components/icons";

export const metadata = { title: "출석" };

function md(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;

  const [trend, absentees, recent, activeCount] = await Promise.all([
    sundayTrend(staff.churchId, 12),
    findAbsentees(staff.churchId),
    prisma.attendanceRecord.findMany({
      where: { churchId: staff.churchId },
      orderBy: [{ date: "desc" }, { service: "asc" }],
      take: 12,
      select: { id: true, date: true, service: true, visitorCount: true, _count: { select: { checks: true } } },
    }),
    prisma.member.count({ where: { churchId: staff.churchId, status: "ACTIVE" } }),
  ]);

  const latest = trend.at(-1);
  const previous = trend.at(-2);
  const diff = latest && previous ? latest.total - previous.total : null;
  const max = Math.max(1, ...trend.map((t) => t.total));
  const rate = latest && activeCount ? Math.round((latest.members / activeCount) * 100) : null;
  const pastoral = canPastoral(staff.role);

  return (
    <>
      <PageHeader
        eyebrow="교회"
        title="출석"
        description="주일마다 출석을 체크해 두면 추이와 오래 못 나오신 분을 한눈에 볼 수 있습니다."
        actions={
          <Link href="/attendance/check" className="btn btn-primary">
            <IconCalendarCheck width={17} height={17} />
            출석 체크
          </Link>
        }
      />

      {sp.ok === "deleted" && (
        <div className="mb-5">
          <Alert tone="income">출석부를 지웠습니다.</Alert>
        </div>
      )}

      {trend.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconCalendarCheck />}
            title="아직 출석부가 없습니다"
            description="이번 주일 출석부터 체크해 보세요. 교구별로 이름을 누르기만 하면 됩니다."
            action={
              <Link href="/attendance/check" className="btn btn-primary">
                <IconPlus width={16} height={16} />
                첫 출석 체크
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">최근 주일 · {latest && ymd(latest.date)}</p>
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="tnum text-[2.4rem] font-bold leading-none tracking-[-0.03em] text-ink">
                    {latest?.total ?? 0}
                  </span>
                  <span className="text-ink-2">명</span>
                  {diff !== null && diff !== 0 && (
                    <span className={`tnum text-sm font-semibold ${diff > 0 ? "text-income" : "text-expense"}`}>
                      {diff > 0 ? "▲" : "▼"} {Math.abs(diff)}
                    </span>
                  )}
                </p>
                <p className="mt-1.5 text-sm text-ink-3">
                  교인 <span className="tnum">{latest?.members}</span> · 방문 <span className="tnum">{latest?.visitors}</span>
                  {rate !== null && (
                    <>
                      {" "}· 재적 대비 <span className="tnum">{rate}%</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* 주별 막대. 가장 최근 주만 진하게. */}
            <div className="mt-6 flex h-36 items-end gap-1.5 sm:gap-2.5" role="img" aria-label="최근 주일 출석 추이">
              {trend.map((t, i) => {
                const last = i === trend.length - 1;
                return (
                  <div key={t.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                    <span className={`tnum text-[0.68rem] ${last ? "font-bold text-ink" : "text-ink-3"}`}>
                      {t.total}
                    </span>
                    <div
                      className={`w-full max-w-9 rounded-t-md ${last ? "bg-primary" : "bg-surface-3"}`}
                      style={{ height: `${Math.max(4, (t.total / max) * 100)}%` }}
                    />
                    <span className="tnum text-[0.66rem] text-ink-3">{md(t.date)}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card padded={false}>
            <div className="px-5 pt-5">
              <CardTitle>
                돌아봐야 할 분 <span className="tnum font-medium text-ink-3">{absentees.length}</span>
              </CardTitle>
              <p className="-mt-2 mb-3 text-xs text-ink-3">
                최근 주일 {ABSENCE_ALERT_WEEKS}번 연속 출석 기록이 없는 재적 교인
              </p>
            </div>
            {absentees.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-ink-3">모두 잘 나오고 계십니다.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-line overflow-y-auto border-t border-line">
                {absentees.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar src={a.photoUrl} name={a.name} />
                    <Link href={`/members/${a.id}`} className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {a.name} <span className="font-normal text-ink-3">{a.position}</span>
                      </span>
                      <span className="block text-xs text-ink-3">
                        {a.districtName ? `${a.districtName} · ` : ""}
                        마지막 출석 {a.lastSeen ? ymd(a.lastSeen) : "기록 없음"}
                      </span>
                    </Link>
                    {a.phone && (
                      <a href={`tel:${a.phone}`} className="btn btn-ghost btn-sm" title={fmtPhone(a.phone)}>
                        전화
                      </a>
                    )}
                    {pastoral && (
                      <Link href={`/members/${a.id}?write=1#visits`} className="btn btn-ghost btn-sm">
                        심방
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {recent.length > 0 && (
        <Card padded={false} className="mt-5">
          <div className="px-5 pt-5">
            <CardTitle>최근 출석부</CardTitle>
          </div>
          <ul className="divide-y divide-line border-t border-line">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/attendance/check?date=${ymdDash(r.date)}&service=${r.service}`}
                  className="row-link"
                >
                  <span className="tnum w-24 shrink-0 text-sm text-ink-2">{ymd(r.date)}</span>
                  <span className="flex-1 text-sm font-semibold text-ink">
                    {SERVICES[r.service as Service] ?? r.service}
                  </span>
                  <span className="tnum text-sm text-ink-2">
                    {r._count.checks + r.visitorCount}명
                  </span>
                  <IconChevronRight width={16} height={16} className="text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
