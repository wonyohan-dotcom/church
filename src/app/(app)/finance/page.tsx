import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireFinance, canManageFinance } from "@/lib/auth";
import { getCurrentBalance, getYearSummary, monthRange } from "@/lib/finance";
import { accountTag } from "@/lib/bank-balance";
import { won, ymd } from "@/lib/format";
import { Card, CardTitle, PageHeader, StatCard } from "@/components/ui";
import { YearSelect } from "@/components/year-select";
import { BreakdownBars, MonthlyIncomeExpenseChart } from "@/components/charts";
import { IconPlus, IconSearch, IconTrend } from "@/components/icons";

export const metadata = { title: "회계 관리" };

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const staff = await requireFinance();
  const sp = await searchParams;

  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const isThisYear = year === now.getFullYear();
  const month = now.getMonth() + 1;

  const summary = await getYearSummary(staff.churchId, year);

  const thisMonth = isThisYear ? monthRange(year, month) : monthRange(year, 12);
  const [monthIncome, monthExpense, recentOfferings, recentExpenses] = await Promise.all([
    prisma.offering.aggregate({
      where: { churchId: staff.churchId, date: thisMonth },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { churchId: staff.churchId, date: thisMonth },
      _sum: { amount: true },
    }),
    prisma.offering.findMany({
      where: {
        churchId: staff.churchId,
        date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      },
      include: { account: true, member: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.expense.findMany({
      where: {
        churchId: staff.churchId,
        date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      },
      include: { account: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
  ]);

  // 장부 전체 잔액과, 은행 문자에 찍힌 통장 잔액(통장마다 가장 최근 문자)
  const [current, before, bankAlerts] = await Promise.all([
    getCurrentBalance(staff.churchId),
    Promise.all([
      prisma.offering.aggregate({ where: { churchId: staff.churchId, date: { lt: new Date(year, 0, 1) } }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { churchId: staff.churchId, date: { lt: new Date(year, 0, 1) } }, _sum: { amount: true } }),
    ]),
    prisma.bankAlert.findMany({
      where: { churchId: staff.churchId, balance: { not: null }, source: { not: "BALANCE" } },
      orderBy: { occurredAt: "desc" },
      take: 50,
      select: { balance: true, bankName: true, rawText: true, occurredAt: true },
    }),
  ]);
  const carried = (before[0]._sum.amount ?? 0) - (before[1]._sum.amount ?? 0);
  const seen = new Set<string>();
  const bankAccounts: { label: string; when: string; balance: number }[] = [];
  for (const a of bankAlerts) {
    const key = `${a.bankName ?? ""}|${accountTag(a.rawText) ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const d = a.occurredAt;
    bankAccounts.push({
      label: a.bankName ?? "통장",
      when: `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      balance: a.balance!,
    });
  }
  const bankTotal = bankAccounts.length ? bankAccounts.reduce((s, b) => s + b.balance, 0) : null;

  const bankPending = canManageFinance(staff.role)
    ? await prisma.bankAlert.count({ where: { churchId: staff.churchId, status: "PENDING" } })
    : 0;

  const balance = summary.totalIncome - summary.totalExpense;
  const monthLabel = isThisYear ? `${month}월` : "12월";
  const canEdit = canManageFinance(staff.role);

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  return (
    <>
      <PageHeader
        title="회계 관리"
        description={`${year}년 헌금과 지출을 한눈에 확인합니다.`}
        actions={
          <>
            <YearSelect year={year} years={years} basePath="/finance" />
            {canEdit && (
              <>
                <Link href="/finance/bank" className="btn btn-ghost">
                  입출금 알림함
                  {bankPending > 0 && (
                    <span className="tnum rounded-full bg-primary px-1.5 text-xs font-bold text-primary-ink">
                      {bankPending}
                    </span>
                  )}
                </Link>
                <Link href="/finance/offerings/link" className="btn btn-ghost">
                  헌금자 이름 연결
                </Link>
                <Link href="/finance/import" className="btn btn-ghost">
                  엑셀 가져오기
                </Link>
                <Link href="/finance/expenses/new" className="btn btn-ghost">
                  지출 입력
                </Link>
                <Link href="/finance/offerings/new" className="btn btn-primary">
                  <IconPlus width={16} height={16} />
                  헌금 입력
                </Link>
              </>
            )}
          </>
        }
      />

      {/* 수입·지출 내역 찾기 — 가장 자주 쓰는 기능이라 맨 위에 둔다 */}
      <form action="/finance/ledger" method="get" className="card mb-5 flex items-center gap-2 p-2 pl-3">
        <IconSearch width={18} height={18} className="shrink-0 text-ink-3" />
        <input type="hidden" name="year" value={year} />
        <input
          name="q"
          type="search"
          placeholder="수입·지출 찾기 (이름, 거래처, 적요, 금액)"
          className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-ink outline-none placeholder:text-ink-3"
          enterKeyHint="search"
        />
        <Link href={`/finance/ledger?year=${year}`} className="btn btn-ghost btn-sm shrink-0">
          전체 내역
        </Link>
      </form>

      {bankPending > 0 && (
        <Link
          href="/finance/bank"
          className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary-soft-ink"
        >
          <span>은행 입출금 알림 {bankPending}건이 기록을 기다리고 있습니다.</span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={`${monthLabel} 수입`}
          value={won(monthIncome._sum.amount ?? 0)}
          tone="income"
        />
        <StatCard
          label={`${monthLabel} 지출`}
          value={won(monthExpense._sum.amount ?? 0)}
          tone="expense"
        />
        <StatCard label={`${year}년 총수입`} value={won(summary.totalIncome)} icon={<IconTrend />} />
        <StatCard
          label={`${year}년 수입−지출`}
          value={won(balance)}
          sub={`총지출 ${won(summary.totalExpense)}`}
          tone={balance >= 0 ? "primary" : "expense"}
        />
      </div>

      {/* 지금 통장에 있어야 할 돈 — 해마다 넘어온 돈까지 모두 더한 잔액. 은행 문자의 잔액과 맞춰 본다. */}
      <Card className="mb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">현재 잔액 (장부 전체)</p>
            <p className="tnum mt-1.5 text-[1.9rem] font-bold leading-none tracking-[-0.03em] text-ink">
              {won(current.balance)}
            </p>
            <p className="mt-1.5 text-xs text-ink-3">
              처음 기록부터 지금까지 모든 수입에서 지출을 뺀 돈
              {carried !== 0 && ` · ${year}년 이전에서 넘어온 돈 ${won(carried)} 포함`}
            </p>
          </div>
          <Link href="/finance/ledger" className="text-sm font-semibold text-primary">
            내역 보기 →
          </Link>
        </div>
        {bankTotal !== null && (
          <div
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${bankTotal === current.balance ? "bg-income-soft text-income" : "bg-warn-soft text-warn"}`}
          >
            <p className="font-semibold">
              통장 잔액 {won(bankTotal)}{" "}
              {bankTotal === current.balance
                ? "— 장부와 똑같습니다 ✓"
                : `— 장부와 ${won(Math.abs(bankTotal - current.balance))} 차이`}
            </p>
            <p className="mt-0.5 text-xs opacity-80">
              {bankAccounts.map((b) => `${b.label} ${b.when} 문자 기준`).join(" · ")}
              {bankTotal !== current.balance &&
                (bankPending > 0
                  ? ` · 입출금 알림함에 기록하지 않은 알림 ${bankPending}건이 있습니다.`
                  : " · 그 뒤에 입력한 기록이 있거나, 문자 없이 오간 돈이 있을 수 있습니다.")}
            </p>
          </div>
        )}
      </Card>

      <div className="mb-5">
        <Card>
          <CardTitle>월별 수입 · 지출</CardTitle>
          <MonthlyIncomeExpenseChart data={summary.monthly} />
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle
            action={
              <Link
                href={`/finance/report?year=${year}`}
                className="text-sm font-semibold text-primary hover:underline"
              >
                결산서
              </Link>
            }
          >
            헌금 종류별 ({year}년)
          </CardTitle>
          <BreakdownBars
            items={summary.incomeByAccount}
            emptyText="아직 입력된 헌금이 없습니다."
          />
        </Card>

        <Card>
          <CardTitle>지출 항목별 ({year}년)</CardTitle>
          <BreakdownBars
            items={summary.expenseByAccount}
            emptyText="아직 입력된 지출이 없습니다."
          />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card padded={false}>
          <div className="p-5 pb-3">
            <CardTitle
              action={
                <Link
                  href="/finance/offerings"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  전체 보기
                </Link>
              }
            >
              최근 헌금
            </CardTitle>
          </div>
          {recentOfferings.length === 0 ? (
            <p className="px-5 pb-6 text-center text-sm text-ink-3">기록이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentOfferings.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {o.account.name}
                    </span>
                    <span className="tnum block truncate text-xs text-ink-3">
                      {ymd(o.date)}
                      {(o.member?.name || o.donorName) &&
                        ` · ${o.member?.name ?? o.donorName}`}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-sm font-semibold text-income">
                    {won(o.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padded={false}>
          <div className="p-5 pb-3">
            <CardTitle
              action={
                <Link
                  href="/finance/expenses"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  전체 보기
                </Link>
              }
            >
              최근 지출
            </CardTitle>
          </div>
          {recentExpenses.length === 0 ? (
            <p className="px-5 pb-6 text-center text-sm text-ink-3">기록이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentExpenses.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {e.account.name}
                    </span>
                    <span className="tnum block truncate text-xs text-ink-3">
                      {ymd(e.date)}
                      {e.payee && ` · ${e.payee}`}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-sm font-semibold text-expense">
                    {won(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-5 flex justify-center">
        <Link href="/finance/accounts" className="btn btn-quiet btn-sm">
          계정과목 관리
        </Link>
      </div>
    </>
  );
}
