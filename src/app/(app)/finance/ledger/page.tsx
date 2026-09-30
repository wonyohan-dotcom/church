import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth";
import { won, ymdDash } from "@/lib/format";
import { giverInclude, giverLabel } from "@/lib/offering-givers";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { IconSearch, IconWallet } from "@/components/icons";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "수입·지출 내역" };

const PAGE_SIZE = 80;
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

type Row = {
  id: string;
  kind: "IN" | "OUT";
  date: Date;
  createdAt: Date;
  amount: number;
  account: string;
  who: string;
  memo: string | null;
  href: string;
};

/**
 * 수입(헌금)과 지출을 한 목록으로 본다. 이름·거래처·적요·항목·금액으로 찾을 수 있다.
 * 홈 화면의 '이번 달 수입·지출', '현재 잔액'을 누르면 이 화면으로 온다.
 */
export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; type?: string; q?: string; page?: string }>;
}) {
  const staff = await requireFinance();
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = sp.month ? Number(sp.month) : 0;
  const type = sp.type === "in" || sp.type === "out" ? sp.type : "all";
  const q = (sp.q ?? "").trim().slice(0, 50);
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const range =
    month > 0
      ? { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) }
      : { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) };
  // "50,000" 이나 "5만" 으로 찾으면 금액으로도 찾는다.
  const amountQ = toAmount(q);
  const has = { contains: q, mode: "insensitive" as const };

  const offeringWhere: Prisma.OfferingWhereInput = {
    churchId: staff.churchId,
    date: range,
    ...(q && {
      OR: [
        { donorName: has },
        { note: has },
        { account: { name: has } },
        { member: { name: has } },
        { coGivers: { some: { member: { name: has } } } },
        ...(amountQ ? [{ amount: amountQ }] : []),
      ],
    }),
  };
  const expenseWhere: Prisma.ExpenseWhereInput = {
    churchId: staff.churchId,
    date: range,
    ...(q && {
      OR: [
        { payee: has },
        { description: has },
        { note: has },
        { account: { name: has } },
        { account: { category: has } },
        ...(amountQ ? [{ amount: amountQ }] : []),
      ],
    }),
  };

  // 한 해 기록은 많아야 수천 건이라 모두 받아서 합치고 나눈다.
  const [offerings, expenses, yearIn, yearOut] = await Promise.all([
    type === "out"
      ? []
      : prisma.offering.findMany({ where: offeringWhere, include: { account: true, ...giverInclude } }),
    type === "in" ? [] : prisma.expense.findMany({ where: expenseWhere, include: { account: true } }),
    // 달별 합계 (검색어와 상관없이 그 해 전체)
    prisma.offering.findMany({
      where: { churchId: staff.churchId, date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      select: { date: true, amount: true },
    }),
    prisma.expense.findMany({
      where: { churchId: staff.churchId, date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      select: { date: true, amount: true },
    }),
  ]);

  const rows: Row[] = [
    ...offerings.map((o) => ({
      id: o.id,
      kind: "IN" as const,
      date: o.date,
      createdAt: o.createdAt,
      amount: o.amount,
      account: o.account.name,
      who: giverLabel(o),
      memo: o.note,
      href: `/finance/offerings/${o.id}`,
    })),
    ...expenses.map((e) => ({
      id: e.id,
      kind: "OUT" as const,
      date: e.date,
      createdAt: e.createdAt,
      amount: e.amount,
      account: e.account.name,
      who: e.payee ?? "",
      memo: e.description ?? e.note,
      href: `/finance/expenses/${e.id}`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime());

  const totalIn = rows.reduce((s, r) => s + (r.kind === "IN" ? r.amount : 0), 0);
  const totalOut = rows.reduce((s, r) => s + (r.kind === "OUT" ? r.amount : 0), 0);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const monthly = Array.from({ length: 12 }, () => ({ in: 0, out: 0 }));
  for (const r of yearIn) monthly[r.date.getMonth()].in += r.amount;
  for (const r of yearOut) monthly[r.date.getMonth()].out += r.amount;
  const maxMonth = Math.max(1, ...monthly.map((m) => Math.max(m.in, m.out)));

  // 날짜별로 묶는다
  const days: { key: string; date: Date; rows: Row[]; in: number; out: number }[] = [];
  for (const r of shown) {
    const key = ymdDash(r.date);
    let d = days[days.length - 1];
    if (d?.key !== key) days.push((d = { key, date: r.date, rows: [], in: 0, out: 0 }));
    d.rows.push(r);
    if (r.kind === "IN") d.in += r.amount;
    else d.out += r.amount;
  }

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);
  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { year, month, type: type === "all" ? undefined : type, q: q || undefined, page: undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "" && v !== 0 && v !== "all") params.set(k, String(v));
    }
    const s = params.toString();
    return `/finance/ledger${s ? `?${s}` : ""}`;
  };
  const period = month > 0 ? `${year}년 ${month}월` : `${year}년`;

  return (
    <>
      <PageHeader
        title="수입·지출 내역"
        description="헌금과 지출을 한곳에서 찾아봅니다. 이름, 거래처, 적요, 금액으로 검색할 수 있습니다."
        back={{ href: "/finance", label: "회계 관리" }}
      />

      {/* 검색 */}
      <form method="get" className="card mb-3 space-y-3 p-4">
        {month > 0 && <input type="hidden" name="month" value={month} />}
        {type !== "all" && <input type="hidden" name="type" value={type} />}
        <label className="relative block">
          <IconSearch width={17} height={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            name="q"
            defaultValue={q}
            placeholder="예) 김은혜, 전기요금, 쿠팡, 50000"
            className="field" style={{ paddingLeft: "2.5rem" }}
            enterKeyHint="search"
            type="search"
          />
        </label>
        <div className="flex gap-2">
          <select name="year" defaultValue={String(year)} className="field w-[7.5rem]" aria-label="연도">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary flex-1">
            찾기
          </button>
          {q && (
            <Link href={href({ q: undefined })} className="btn btn-ghost">
              지우기
            </Link>
          )}
        </div>
      </form>

      {/* 구분 */}
      <div className="mb-3 flex gap-1 rounded-xl bg-surface-2 p-1 text-sm font-semibold">
        {(
          [
            ["all", "전체"],
            ["in", "수입"],
            ["out", "지출"],
          ] as const
        ).map(([t, label]) => (
          <Link
            key={t}
            href={href({ type: t })}
            className={`flex-1 rounded-lg px-3 py-2 text-center ${type === t ? "bg-surface text-ink shadow-sm" : "text-ink-3"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* 달 고르기 */}
      <nav className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="달 고르기">
        <div className="flex w-max gap-1.5">
          {[0, ...Array.from({ length: 12 }, (_, i) => i + 1)].map((m) => (
            <Link
              key={m}
              href={href({ month: m })}
              aria-current={m === month ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                m === month ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-2 hover:bg-surface-3"
              }`}
            >
              {m === 0 ? "전체" : `${m}월`}
            </Link>
          ))}
        </div>
      </nav>

      {/* 합계 — 한 줄에 세 칸. 금액이 길면 칸에 맞춰 글자가 줄어든다 */}
      <div className="card mb-5 grid grid-cols-3 divide-x divide-line">
        {[
          { label: `${period} 수입`, value: totalIn, tone: "text-income" },
          { label: `${period} 지출`, value: totalOut, tone: "text-expense" },
          { label: "차액", value: totalIn - totalOut, tone: totalIn - totalOut >= 0 ? "text-primary" : "text-expense" },
        ].map((x) => (
          <div key={x.label} className="stat px-3 py-3.5 sm:px-5">
            <p className="truncate text-[0.72rem] font-semibold text-ink-3">{x.label}</p>
            <p className={`stat-value tnum mt-1 whitespace-nowrap font-bold ${x.tone}`}>{won(x.value)}</p>
          </div>
        ))}
      </div>

      {/* 달별 수입·지출 (전체 보기이고 검색하지 않을 때) */}
      {month === 0 && !q && (
        <Card className="mb-5" padded={false}>
          <div className="flex items-center justify-between px-4 pb-1 pt-4">
            <p className="text-[0.95rem] font-bold text-ink">달별 수입·지출</p>
            <p className="flex gap-3 text-xs text-ink-3">
              <span><span className="mr-1 inline-block size-2 rounded-full bg-income" />수입</span>
              <span><span className="mr-1 inline-block size-2 rounded-full bg-expense" />지출</span>
            </p>
          </div>
          <ul className="px-2 pb-2">
            {monthly.map((m, i) => {
              const empty = !m.in && !m.out;
              return (
                <li key={i}>
                  <Link
                    href={href({ month: i + 1 })}
                    className="grid grid-cols-[2.6rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2"
                  >
                    <span className={`tnum text-sm font-semibold ${empty ? "text-ink-3" : "text-ink-2"}`}>{i + 1}월</span>
                    <span className="space-y-1">
                      <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full rounded-full bg-income" style={{ width: `${(m.in / maxMonth) * 100}%` }} />
                      </span>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full rounded-full bg-expense" style={{ width: `${(m.out / maxMonth) * 100}%` }} />
                      </span>
                    </span>
                    <span className="tnum min-w-[6.5rem] text-right text-xs leading-tight">
                      {empty ? (
                        <span className="text-ink-3">-</span>
                      ) : (
                        <>
                          <span className="block font-semibold text-income">+{won(m.in)}</span>
                          <span className="block font-semibold text-expense">−{won(m.out)}</span>
                        </>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconWallet />}
            title={q ? `‘${q}’ 에 맞는 내역이 없습니다` : "이 기간에 기록이 없습니다"}
            description={q ? "다른 낱말로 찾거나 달을 ‘전체’로 바꿔 보세요." : "다른 달을 눌러 보세요."}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="px-1 text-xs text-ink-3">
            {q ? `‘${q}’ 검색 결과 ` : ""}
            {rows.length.toLocaleString("ko-KR")}건 · 누르면 자세히 보고 고칠 수 있습니다.
          </p>
          {days.map((d) => (
            <section key={d.key}>
              <div className="flex items-baseline justify-between gap-3 px-1 pb-1.5 text-sm">
                <span className="font-semibold text-ink-2">
                  {d.date.getMonth() + 1}월 {d.date.getDate()}일 ({WEEKDAY[d.date.getDay()]})
                </span>
                <span className="tnum text-xs">
                  {d.in > 0 && <span className="text-income">+{won(d.in)}</span>}
                  {d.in > 0 && d.out > 0 && <span className="text-ink-3"> · </span>}
                  {d.out > 0 && <span className="text-expense">−{won(d.out)}</span>}
                </span>
              </div>
              <ul className="card divide-y divide-line">
                {d.rows.map((r) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <Link href={r.href} className="flex items-center gap-3 p-3.5 hover:bg-surface-2">
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${
                          r.kind === "IN" ? "bg-income-soft text-income" : "bg-expense-soft text-expense"
                        }`}
                      >
                        {r.kind === "IN" ? "수입" : "지출"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{r.account}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {[r.who, r.memo].filter(Boolean).join(" · ") || "-"}
                        </span>
                      </span>
                      <span className={`tnum shrink-0 text-sm font-semibold ${r.kind === "IN" ? "text-income" : "text-expense"}`}>
                        {r.kind === "IN" ? "+" : "−"}
                        {won(r.amount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={href({ page: page - 1 })} className="btn btn-ghost btn-sm">
              이전
            </Link>
          )}
          <span className="tnum px-2 text-sm text-ink-3">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={href({ page: page + 1 })} className="btn btn-ghost btn-sm">
              다음
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

/** "50,000", "5만", "50000원" → 50000. 금액이 아니면 null */
function toAmount(q: string): number | null {
  const t = q.replace(/[,\s원]/g, "");
  const man = /^(\d+(?:\.\d+)?)만$/.exec(t);
  if (man) return Math.round(Number(man[1]) * 10_000);
  return /^\d{3,10}$/.test(t) ? Number(t) : null;
}
