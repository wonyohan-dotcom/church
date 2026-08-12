import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { HISTORY_CATEGORIES, type HistoryCategory } from "@/lib/constants";
import { ymd } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { IconBook, IconPlus } from "@/components/icons";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "교회 역사" };

const CATEGORY_TONE: Record<HistoryCategory, "primary" | "accent" | "income" | "warn" | "neutral"> =
  {
    FOUNDING: "accent",
    BUILDING: "primary",
    ORDINATION: "income",
    PASTOR: "primary",
    MISSION: "warn",
    EVENT: "neutral",
    GENERAL: "neutral",
  };

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;

  const category = sp.category ?? "";
  const q = sp.q?.trim() ?? "";

  const where: Prisma.HistoryEventWhereInput = {
    churchId: staff.churchId,
    ...(category ? { category } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { content: { contains: q } }] } : {}),
  };

  const [events, church, total, photoCount] = await Promise.all([
    prisma.historyEvent.findMany({
      where,
      include: { photos: { orderBy: { sortOrder: "asc" }, take: 4 } },
      orderBy: [{ date: "desc" }],
    }),
    getChurch(staff.churchId),
    prisma.historyEvent.count({ where: { churchId: staff.churchId } }),
    prisma.historyPhoto.count({ where: { churchId: staff.churchId } }),
  ]);

  // 연도별로 묶어 세로 연표처럼 보여 준다.
  const byYear = new Map<number, typeof events>();
  for (const e of events) {
    const y = e.date.getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(e);
  }
  const yearsDesc = [...byYear.keys()].sort((a, b) => b - a);

  const oldest = await prisma.historyEvent.findFirst({
    where: { churchId: staff.churchId },
    orderBy: { date: "asc" },
  });
  const spanYears = oldest
    ? new Date().getFullYear() - oldest.date.getFullYear()
    : 0;

  return (
    <>
      <PageHeader
        title="교회 역사"
        description={`${church.name}의 발자취를 연도별로 기록합니다.`}
        actions={
          <Link href="/history/new" className="btn btn-primary">
            <IconPlus width={16} height={16} />
            연혁 등록
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="기록된 연혁" value={`${total}건`} tone="primary" />
        <StatCard label="보관 사진" value={`${photoCount}장`} />
        <StatCard
          label="기록 기간"
          value={oldest ? `${spanYears}년` : "-"}
          sub={oldest ? `${oldest.date.getFullYear()}년부터` : undefined}
        />
      </div>

      <form method="get" className="card mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[10rem] flex-1">
          <label className="label" htmlFor="q">
            검색
          </label>
          <input id="q" name="q" defaultValue={q} className="field" placeholder="제목, 내용" />
        </div>
        <div className="w-[9.5rem]">
          <label className="label" htmlFor="category">
            분류
          </label>
          <select id="category" name="category" defaultValue={category} className="field">
            <option value="">전체</option>
            {Object.entries(HISTORY_CATEGORIES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          검색
        </button>
      </form>

      {events.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconBook />}
            title="기록된 연혁이 없습니다"
            description="교회 설립, 건축, 임직, 주요 행사를 사진과 함께 남겨 보세요. 다음 세대에 전할 소중한 기록이 됩니다."
            action={
              <Link href="/history/new" className="btn btn-primary">
                <IconPlus width={16} height={16} />
                첫 연혁 등록하기
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {yearsDesc.map((year) => (
            <section key={year}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="tnum text-lg font-bold tracking-[-0.01em] text-ink">{year}년</h2>
                <span className="h-px flex-1 bg-line" />
                <span className="text-xs text-ink-3">{byYear.get(year)!.length}건</span>
              </div>

              <ul className="space-y-3">
                {byYear.get(year)!.map((e) => (
                  <li key={e.id}>
                    <Link href={`/history/${e.id}`} className="card block p-4 transition-colors hover:bg-surface-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={CATEGORY_TONE[e.category as HistoryCategory] ?? "neutral"}>
                          {HISTORY_CATEGORIES[e.category as HistoryCategory] ?? e.category}
                        </Badge>
                        <span className="tnum text-xs text-ink-3">
                          {ymd(e.date)}
                          {e.dateIsApprox && " 무렵"}
                        </span>
                        {e.pinned && <Badge tone="accent">주요</Badge>}
                      </div>

                      <h3 className="mt-2 font-bold tracking-[-0.01em] text-ink">{e.title}</h3>
                      {e.content && (
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-2">
                          {e.content}
                        </p>
                      )}

                      {e.photos.length > 0 && (
                        <div className="mt-3 flex gap-2">
                          {e.photos.map((p) => (
                            <span
                              key={p.id}
                              className="h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2"
                            >
                              {/* 업로드된 사진은 임의 경로라 기본 img를 쓴다. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.url} alt="" className="h-full w-full object-cover" />
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
