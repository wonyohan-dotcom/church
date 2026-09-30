import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePastoral } from "@/lib/auth";
import { findAbsentees } from "@/lib/attendance";
import { VISIT_KINDS, type VisitKind } from "@/lib/constants";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { VisitList } from "@/components/visit-list";
import { IconCare, IconSearch } from "@/components/icons";

export const metadata = { title: "심방·상담" };

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string }>;
}) {
  const staff = await requirePastoral();
  const sp = await searchParams;
  const kind = sp.kind && sp.kind in VISIT_KINDS ? (sp.kind as VisitKind) : null;
  const q = sp.q?.trim() ?? "";

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [visits, monthCount, absentees, found] = await Promise.all([
    prisma.visit.findMany({
      where: { churchId: staff.churchId, ...(kind ? { kind } : {}) },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        member: { select: { id: true, name: true, position: true } },
        createdBy: { select: { name: true } },
      },
      take: 60,
    }),
    prisma.visit.count({ where: { churchId: staff.churchId, date: { gte: monthStart } } }),
    findAbsentees(staff.churchId),
    q
      ? prisma.member.findMany({
          where: { churchId: staff.churchId, name: { contains: q } },
          select: { id: true, name: true, position: true },
          take: 8,
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="교회"
        title="심방 · 상담"
        description={`이번 달 ${monthCount}건. 기록은 관리자와 교역자만 볼 수 있습니다.`}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="order-2 lg:order-1">
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Link
              href="/visits"
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${!kind ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-2"}`}
            >
              전체
            </Link>
            {Object.entries(VISIT_KINDS).map(([v, l]) => (
              <Link
                key={v}
                href={`/visits?kind=${v}`}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${kind === v ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-2"}`}
              >
                {l}
              </Link>
            ))}
          </div>
          <Card>
            {visits.length === 0 ? (
              <EmptyState
                icon={<IconCare />}
                title="아직 기록이 없습니다"
                description="교인 이름을 찾아 상세 화면에서 심방·상담 기록을 남길 수 있습니다."
              />
            ) : (
              <VisitList
                visits={visits.map((v) => ({ ...v, writer: v.createdBy?.name ?? null }))}
                showMember
              />
            )}
          </Card>
        </div>

        <div className="order-1 space-y-5 lg:order-2">
          <Card>
            <CardTitle>새 기록 쓰기</CardTitle>
            <form method="get" className="relative">
              <IconSearch
                width={17}
                height={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
              />
              <input name="q" defaultValue={q} className="field pl-9" placeholder="교인 이름" autoComplete="off" />
            </form>
            {q && (
              <ul className="mt-3 divide-y divide-line">
                {found.length === 0 && <li className="py-2 text-sm text-ink-3">찾는 교인이 없습니다.</li>}
                {found.map((m) => (
                  <li key={m.id}>
                    <Link href={`/members/${m.id}?write=1#visits`} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="font-semibold text-ink">
                        {m.name} <span className="font-normal text-ink-3">{m.position}</span>
                      </span>
                      <span className="text-primary">기록 쓰기 →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {absentees.length > 0 && (
            <Card>
              <CardTitle>오래 못 나오신 분</CardTitle>
              <ul className="divide-y divide-line">
                {absentees.slice(0, 8).map((a) => (
                  <li key={a.id}>
                    <Link href={`/members/${a.id}?write=1#visits`} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="font-semibold text-ink">
                        {a.name} <span className="font-normal text-ink-3">{a.position}</span>
                      </span>
                      <span className="text-xs text-ink-3">{a.districtName ?? ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
