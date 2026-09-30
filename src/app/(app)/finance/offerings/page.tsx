import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireFinance, canManageFinance } from "@/lib/auth";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { won, ymdDash } from "@/lib/format";
import { withBack } from "@/lib/back";
import { findLinkable, giverInclude, giverLabel, givenBy, giversOf } from "@/lib/offering-givers";
import { Alert, Card, EmptyState, PageHeader, StatCard, TableWrap } from "@/components/ui";
import { GiverButton, GiverPickerProvider, GiverPress } from "@/components/giver-picker";
import { IconPlus, IconUsers, IconWallet } from "@/components/icons";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "헌금 내역" };

const PAGE_SIZE = 50;
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

const MESSAGES: Record<string, string> = {
  created: "헌금이 입력되었습니다.",
  updated: "헌금 내역이 수정되었습니다.",
  deleted: "헌금 내역이 삭제되었습니다.",
};

function dayLabel(d: Date) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]})`;
}

export default async function OfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    account?: string;
    member?: string;
    page?: string;
    ok?: string;
  }>;
}) {
  const staff = await requireFinance();
  const sp = await searchParams;

  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = sp.month ? Number(sp.month) : 0; // 0 = 전체
  const accountId = sp.account ?? "";
  const memberId = sp.member ?? "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const canEdit = canManageFinance(staff.role);

  // 연도 전체 조건 (월별 합계용) 과 선택한 달 조건 (목록용)
  const yearWhere: Prisma.OfferingWhereInput = {
    churchId: staff.churchId,
    date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
    ...(accountId ? { accountId } : {}),
    // 함께 드린 헌금도 그 교인의 헌금으로 본다.
    ...(memberId ? givenBy(memberId) : {}),
  };
  const where: Prisma.OfferingWhereInput =
    month > 0
      ? { ...yearWhere, date: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } }
      : yearWhere;

  const [offerings, yearRows, accounts, member, members, linkable] = await Promise.all([
    prisma.offering.findMany({
      where,
      include: { account: true, ...giverInclude },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    // 월별·날짜별 합계. 한 해 헌금은 많아야 수천 건이라 금액과 날짜만 받아 여기서 더한다.
    prisma.offering.findMany({ where: yearWhere, select: { date: true, amount: true } }),
    prisma.account.findMany({
      where: { churchId: staff.churchId, type: "INCOME" },
      orderBy: { sortOrder: "asc" },
    }),
    memberId
      ? prisma.member.findFirst({ where: { id: memberId, churchId: staff.churchId } })
      : null,
    canEdit
      ? prisma.member.findMany({
          where: { churchId: staff.churchId },
          select: { id: true, name: true, position: true, status: true, district: { select: { name: true } } },
          orderBy: [{ status: "asc" }, { name: "asc" }],
        })
      : [],
    canEdit && !memberId ? findLinkable(staff.churchId) : [],
  ]);

  const monthly = Array.from({ length: 12 }, () => ({ amount: 0, count: 0 }));
  const byDay = new Map<string, { amount: number; count: number }>();
  for (const r of yearRows) {
    const m = monthly[r.date.getMonth()];
    m.amount += r.amount;
    m.count += 1;
    const k = ymdDash(r.date);
    const d = byDay.get(k) ?? { amount: 0, count: 0 };
    d.amount += r.amount;
    d.count += 1;
    byDay.set(k, d);
  }
  const scope = month > 0 ? monthly[month - 1] : monthly.reduce(
    (s, m) => ({ amount: s.amount + m.amount, count: s.count + m.count }),
    { amount: 0, count: 0 },
  );
  const maxMonth = Math.max(1, ...monthly.map((m) => m.amount));
  const lastMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;

  const totalPages = Math.max(1, Math.ceil(scope.count / PAGE_SIZE));
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);
  const linkCount = linkable.reduce((s, g) => s + g.offeringIds.length, 0);

  function hrefWith(patch: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    const merged = { year, month, account: accountId, member: memberId, page: undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "" && v !== 0) params.set(k, String(v));
    }
    const s = params.toString();
    return `/finance/offerings${s ? `?${s}` : ""}`;
  }

  const here = hrefWith({ page: page > 1 ? page : undefined });

  // 목록을 날짜별로 묶는다
  const days: { key: string; date: Date; items: typeof offerings }[] = [];
  for (const o of offerings) {
    const key = ymdDash(o.date);
    const last = days[days.length - 1];
    if (last?.key === key) last.items.push(o);
    else days.push({ key, date: o.date, items: [o] });
  }

  const pickerMembers = members.map((m) => ({
    id: m.id,
    name: m.name,
    sub: [m.position, m.district?.name, m.status !== "ACTIVE" ? "(비활동)" : null]
      .filter(Boolean)
      .join(" · "),
  }));
  const target = (o: (typeof offerings)[number]) => ({
    offeringId: o.id,
    giverIds: giversOf(o).map((g) => g.id),
    title: `${o.date.getMonth() + 1}월 ${o.date.getDate()}일 · ${o.account.name} · ${won(o.amount)}`,
    writtenName: o.donorName,
  });

  return (
    <GiverPickerProvider members={pickerMembers}>
      <PageHeader
        title={member ? `${member.name} 님의 헌금` : "헌금 내역"}
        description={
          member
            ? "혼자 드린 헌금과 다른 분과 함께 드린 헌금을 모두 보여 줍니다."
            : "달을 눌러 그달의 헌금을 봅니다."
        }
        back={
          member
            ? { href: `/members/${member.id}`, label: member.name }
            : { href: "/finance", label: "회계 관리" }
        }
        actions={
          canEdit && (
            <Link href="/finance/offerings/new" className="btn btn-primary">
              <IconPlus width={16} height={16} />
              헌금 입력
            </Link>
          )
        }
      />

      {sp.ok && MESSAGES[sp.ok] && (
        <div className="mb-5">
          <Alert tone="income">{MESSAGES[sp.ok]}</Alert>
        </div>
      )}

      {linkCount > 0 && (
        <Link
          href="/finance/offerings/link"
          className="card mb-5 flex items-center gap-3 border-accent/40 p-4 hover:bg-surface-2"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <IconUsers width={20} height={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">
              교인과 이을 수 있는 헌금 {linkCount}건
            </span>
            <span className="block text-sm text-ink-3">
              “{linkable[0].donorName}” → {linkable[0].memberNames.join(" · ")} 처럼 이름으로 찾았습니다.
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-primary">확인 →</span>
        </Link>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard
          label={month > 0 ? `${year}년 ${month}월` : `${year}년 전체`}
          value={won(scope.amount)}
          tone="income"
          sub={`${scope.count.toLocaleString("ko-KR")}건`}
        />
        <StatCard
          label="월 평균"
          value={won(Math.round(monthly.slice(0, lastMonth).reduce((s, m) => s + m.amount, 0) / lastMonth))}
          sub={`1월~${lastMonth}월 기준`}
        />
      </div>

      {/* 연도·항목 */}
      <form method="get" className="card mb-3 flex flex-wrap items-end gap-3 p-4">
        {memberId && <input type="hidden" name="member" value={memberId} />}
        {month > 0 && <input type="hidden" name="month" value={month} />}
        <div className="w-[7.5rem]">
          <label className="label" htmlFor="year">
            연도
          </label>
          <select id="year" name="year" defaultValue={String(year)} className="field">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[9rem] flex-1">
          <label className="label" htmlFor="account">
            헌금 항목
          </label>
          <select id="account" name="account" defaultValue={accountId} className="field">
            <option value="">전체</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          조회
        </button>
        {memberId && (
          <Link href={hrefWith({ member: undefined })} className="btn btn-quiet">
            교인 필터 해제
          </Link>
        )}
      </form>

      {/* 달 고르기 */}
      <nav className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="달 고르기">
        <div className="flex w-max gap-1.5">
          {[0, ...Array.from({ length: 12 }, (_, i) => i + 1)].map((m) => {
            const on = m === month;
            const empty = m > 0 && monthly[m - 1].count === 0;
            return (
              <Link
                key={m}
                href={hrefWith({ month: m })}
                aria-current={on ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap ${
                  on
                    ? "bg-primary text-primary-ink"
                    : empty
                      ? "bg-surface-2 text-ink-3"
                      : "bg-surface-2 text-ink-2 hover:bg-surface-3"
                }`}
              >
                {m === 0 ? "전체" : `${m}월`}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 월별 합계 */}
      {month === 0 && scope.count > 0 && (
        <Card className="mb-5" padded={false}>
          <p className="px-4 pb-1 pt-4 text-[0.95rem] font-bold text-ink">월별 합계</p>
          <ul className="px-2 pb-2">
            {monthly.map((m, i) => (
              <li key={i}>
                <Link
                  href={hrefWith({ month: i + 1 })}
                  className="grid grid-cols-[2.6rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2"
                >
                  <span className={`tnum text-sm font-semibold ${m.count ? "text-ink-2" : "text-ink-3"}`}>
                    {i + 1}월
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="block h-full rounded-full bg-income"
                      style={{ width: `${(m.amount / maxMonth) * 100}%` }}
                    />
                  </span>
                  <span className="tnum min-w-[7.5rem] text-right text-sm">
                    <span className={`font-semibold ${m.count ? "text-ink" : "text-ink-3"}`}>
                      {m.count ? won(m.amount) : "-"}
                    </span>
                    {m.count > 0 && <span className="ml-1.5 text-xs text-ink-3">{m.count}건</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {offerings.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconWallet />}
            title="해당 기간에 헌금 기록이 없습니다"
            description="다른 달을 누르시거나 새 헌금을 입력해 주세요."
            action={
              canEdit && (
                <Link href="/finance/offerings/new" className="btn btn-primary">
                  <IconPlus width={16} height={16} />
                  헌금 입력
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <>
          {month === 0 && (
            <h2 className="mb-2.5 px-1 text-[0.95rem] font-bold text-ink">최근 헌금</h2>
          )}
          {canEdit && (
            <p className="mb-2.5 px-1 text-xs text-ink-3">
              <span className="sm:hidden">줄을 꾹 누르면</span>
              <span className="hidden sm:inline">헌금자 이름을 누르면</span> 누가 드린 헌금인지 고를 수
              있습니다. 여러 분을 고르면 모두의 헌금 내역에 함께 보입니다.
            </p>
          )}

          {/* 컴퓨터 */}
          <div className="hidden sm:block">
            <TableWrap>
              <table className="table">
                <thead>
                  <tr>
                    <th>항목</th>
                    <th>헌금자</th>
                    <th>방법</th>
                    <th className="text-right">금액</th>
                    <th>메모</th>
                    {canEdit && <th />}
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <DayRows key={d.key}>
                      <tr>
                        <td colSpan={canEdit ? 6 : 5} className="bg-surface-2 py-2">
                          <DayHeader date={d.date} total={byDay.get(d.key)} />
                        </td>
                      </tr>
                      {d.items.map((o) => {
                        const people = giversOf(o);
                        return (
                          <tr key={o.id}>
                            <td className="font-medium text-ink">{o.account.name}</td>
                            <td>
                              {canEdit ? (
                                <GiverButton
                                  {...target(o)}
                                  className={`rounded-md px-1.5 py-0.5 -mx-1.5 text-left hover:bg-surface-3 ${people.length ? "font-medium text-primary" : "text-ink-3"}`}
                                >
                                  {giverLabel(o)}
                                  {people.length > 1 && <span className="ml-1 text-xs text-accent">함께</span>}
                                </GiverButton>
                              ) : (
                                <span className="text-ink-2">{giverLabel(o)}</span>
                              )}
                              {people.length > 0 && o.donorName && o.donorName !== giverLabel(o) && (
                                <span className="block text-xs text-ink-3">“{o.donorName}”</span>
                              )}
                            </td>
                            <td className="text-ink-3">
                              {PAYMENT_METHODS[o.method as PaymentMethod] ?? o.method}
                            </td>
                            <td className="tnum whitespace-nowrap text-right font-semibold text-ink">
                              {won(o.amount)}
                            </td>
                            <td className="max-w-[12rem] truncate text-ink-3">{o.note ?? ""}</td>
                            {canEdit && (
                              <td className="text-right">
                                <Link
                                  href={withBack(`/finance/offerings/${o.id}`, here)}
                                  className="text-sm font-semibold text-primary hover:underline"
                                >
                                  수정
                                </Link>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </DayRows>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>

          {/* 휴대폰 */}
          <div className="space-y-3 sm:hidden">
            {days.map((d) => (
              <section key={d.key}>
                <div className="px-1 pb-1.5">
                  <DayHeader date={d.date} total={byDay.get(d.key)} />
                </div>
                <ul className="card divide-y divide-line">
                  {d.items.map((o) => {
                    const people = giversOf(o);
                    const body = (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {o.account.name}
                          </span>
                          <span className="block truncate text-xs">
                            <span className={people.length ? "font-medium text-primary" : "text-ink-3"}>
                              {giverLabel(o)}
                            </span>
                            {people.length > 1 && <span className="ml-1 text-accent">함께</span>}
                          </span>
                        </span>
                        <span className="tnum shrink-0 text-sm font-semibold text-income">
                          {won(o.amount)}
                        </span>
                      </>
                    );
                    return (
                      <li key={o.id}>
                        {canEdit ? (
                          <GiverPress
                            {...target(o)}
                            href={withBack(`/finance/offerings/${o.id}`, here)}
                            className="flex items-center gap-3 p-3.5 active:bg-surface-2"
                          >
                            {body}
                          </GiverPress>
                        ) : (
                          <div className="flex items-center gap-3 p-3.5">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {totalPages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={hrefWith({ page: page - 1 })} className="btn btn-ghost btn-sm">
              이전
            </Link>
          )}
          <span className="tnum px-2 text-sm text-ink-3">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={hrefWith({ page: page + 1 })} className="btn btn-ghost btn-sm">
              다음
            </Link>
          )}
        </nav>
      )}
    </GiverPickerProvider>
  );
}

function DayRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function DayHeader({ date, total }: { date: Date; total?: { amount: number; count: number } }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="font-semibold text-ink-2">{dayLabel(date)}</span>
      {total && (
        <span className="tnum text-ink-3">
          {total.count}건 · <b className="font-semibold text-ink-2">{won(total.amount)}</b>
        </span>
      )}
    </div>
  );
}
