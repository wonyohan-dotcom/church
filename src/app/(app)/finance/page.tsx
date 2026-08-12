import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff, canManageFinance } from "@/lib/auth";
import { getYearSummary, monthRange } from "@/lib/finance";
import { won, ymd } from "@/lib/format";
import { Card, CardTitle, PageHeader, StatCard } from "@/components/ui";
import { YearSelect } from "@/components/year-select";
import { BreakdownBars, MonthlyIncomeExpenseChart } from "@/components/charts";
import { IconPlus, IconTrend } from "@/components/icons";

export const metadata = { title: "회계 관리" };

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const staff = await requireStaff();
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
          label={`${year}년 잔액`}
          value={won(balance)}
          sub={`지출 ${won(summary.totalExpense)}`}
          tone={balance >= 0 ? "primary" : "expense"}
        />
      </div>

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
