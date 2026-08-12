import { prisma } from "@/lib/prisma";
import { requireStaff, canManageFinance } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { getYearSummary } from "@/lib/finance";
import { won } from "@/lib/format";
import { Card, CardTitle, PageHeader, StatCard, TableWrap } from "@/components/ui";
import { PrintButton, SubmitButton } from "@/components/form";
import { YearSelect } from "@/components/year-select";
import { saveBudget } from "../actions";

export const metadata = { title: "결산서" };

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; ok?: string }>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;

  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();

  const [summary, church, accounts, budgets] = await Promise.all([
    getYearSummary(staff.churchId, year),
    getChurch(staff.churchId),
    prisma.account.findMany({
      where: { churchId: staff.churchId },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.budget.findMany({ where: { churchId: staff.churchId, year } }),
  ]);

  const budgetOf = new Map(budgets.map((b) => [b.accountId, b.amount]));
  const actualOf = new Map([
    ...summary.incomeByAccount.map((a) => [a.id, a.amount] as const),
    ...summary.expenseByAccount.map((a) => [a.id, a.amount] as const),
  ]);

  const incomeAccounts = accounts.filter((a) => a.type === "INCOME");
  const expenseAccounts = accounts.filter((a) => a.type === "EXPENSE");

  const totalBudgetIncome = incomeAccounts.reduce((s, a) => s + (budgetOf.get(a.id) ?? 0), 0);
  const totalBudgetExpense = expenseAccounts.reduce((s, a) => s + (budgetOf.get(a.id) ?? 0), 0);

  const balance = summary.totalIncome - summary.totalExpense;
  const canEdit = canManageFinance(staff.role);
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="결산서"
          description={`${year}년 예산 대비 집행 실적입니다.`}
          back={{ href: "/finance", label: "회계 관리" }}
          actions={
            <>
              <YearSelect year={year} years={years} basePath="/finance/report" />
              <PrintButton />
            </>
          }
        />
      </div>

      {/* 인쇄용 머리글 */}
      <div className="mb-6 hidden text-center print:block">
        <h1 className="text-xl font-bold">
          {church.name} {year}년도 결산서
        </h1>
        <p className="mt-1 text-sm">
          기간: {year}. 01. 01. ~ {year}. 12. 31.
        </p>
      </div>

      <div className="print-page">
        <div className="mb-5 grid grid-cols-3 gap-3">
          <StatCard label="총수입" value={won(summary.totalIncome)} tone="income" />
          <StatCard label="총지출" value={won(summary.totalExpense)} tone="expense" />
          <StatCard
            label="차인 잔액"
            value={won(balance)}
            tone={balance >= 0 ? "primary" : "expense"}
          />
        </div>

        <div className="mb-5">
          <h2 className="mb-2.5 px-1 text-[0.95rem] font-bold text-ink">수입 결산</h2>
          <ReportTable
            rows={incomeAccounts.map((a) => ({
              code: a.code,
              name: a.name,
              category: a.category,
              budget: budgetOf.get(a.id) ?? 0,
              actual: actualOf.get(a.id) ?? 0,
            }))}
            totalBudget={totalBudgetIncome}
            totalActual={summary.totalIncome}
          />
        </div>

        <div className="mb-5">
          <h2 className="mb-2.5 px-1 text-[0.95rem] font-bold text-ink">지출 결산</h2>
          <ReportTable
            rows={expenseAccounts.map((a) => ({
              code: a.code,
              name: a.name,
              category: a.category,
              budget: budgetOf.get(a.id) ?? 0,
              actual: actualOf.get(a.id) ?? 0,
            }))}
            totalBudget={totalBudgetExpense}
            totalActual={summary.totalExpense}
          />
        </div>

        <div className="mb-5">
          <h2 className="mb-2.5 px-1 text-[0.95rem] font-bold text-ink">월별 집계</h2>
          <TableWrap>
            <table className="table">
              <thead>
                <tr>
                  <th>월</th>
                  <th className="text-right">수입</th>
                  <th className="text-right">지출</th>
                  <th className="text-right">월 잔액</th>
                  <th className="text-right">누계 잔액</th>
                </tr>
              </thead>
              <tbody>
                {summary.monthly.map((m, i) => {
                  const cumulative = summary.monthly
                    .slice(0, i + 1)
                    .reduce((s, x) => s + x.income - x.expense, 0);
                  return (
                    <tr key={m.month}>
                      <td className="tnum">{m.label}</td>
                      <td className="tnum text-right">{won(m.income)}</td>
                      <td className="tnum text-right">{won(m.expense)}</td>
                      <td className="tnum text-right">{won(m.income - m.expense)}</td>
                      <td className="tnum text-right font-semibold">{won(cumulative)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </div>

        <p className="mt-8 hidden text-center text-sm print:block">
          위와 같이 {year}년도 결산 내역을 보고합니다.
          <br />
          <br />
          {church.name}
          {church.representative && ` · ${church.representative}`}
        </p>
      </div>

      {/* 예산 입력 */}
      {canEdit && (
        <div className="no-print mt-6">
          <Card>
            <CardTitle>{year}년 예산 입력</CardTitle>
            {sp.ok === "budget" && (
              <p className="mb-4 rounded-lg bg-income-soft px-3 py-2 text-sm font-medium text-income">
                예산이 저장되었습니다.
              </p>
            )}
            <form action={saveBudget.bind(null, year)} className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <BudgetGroup
                  title="수입 예산"
                  accounts={incomeAccounts}
                  budgetOf={budgetOf}
                />
                <BudgetGroup
                  title="지출 예산"
                  accounts={expenseAccounts}
                  budgetOf={budgetOf}
                />
              </div>
              <div className="flex justify-end">
                <SubmitButton>예산 저장</SubmitButton>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}

function ReportTable({
  rows,
  totalBudget,
  totalActual,
}: {
  rows: Array<{
    code: string;
    name: string;
    category: string | null;
    budget: number;
    actual: number;
  }>;
  totalBudget: number;
  totalActual: number;
}) {
  return (
    <TableWrap>
      <table className="table">
        <thead>
          <tr>
            <th>코드</th>
            <th>과목</th>
            <th className="text-right">예산</th>
            <th className="text-right">결산</th>
            <th className="text-right">차액</th>
            <th className="text-right">집행률</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code}>
              <td className="tnum text-ink-3">{r.code}</td>
              <td>
                <span className="font-medium text-ink">{r.name}</span>
                {r.category && <span className="block text-xs text-ink-3">{r.category}</span>}
              </td>
              <td className="tnum text-right text-ink-2">{won(r.budget)}</td>
              <td className="tnum text-right font-semibold text-ink">{won(r.actual)}</td>
              <td className="tnum text-right text-ink-2">{won(r.budget - r.actual)}</td>
              <td className="tnum text-right text-ink-2">
                {r.budget > 0 ? `${Math.round((r.actual / r.budget) * 100)}%` : "-"}
              </td>
            </tr>
          ))}
          <tr>
            <td />
            <td className="font-bold text-ink">합계</td>
            <td className="tnum text-right font-bold text-ink">{won(totalBudget)}</td>
            <td className="tnum text-right font-bold text-ink">{won(totalActual)}</td>
            <td className="tnum text-right font-bold text-ink">
              {won(totalBudget - totalActual)}
            </td>
            <td className="tnum text-right font-bold text-ink">
              {totalBudget > 0 ? `${Math.round((totalActual / totalBudget) * 100)}%` : "-"}
            </td>
          </tr>
        </tbody>
      </table>
    </TableWrap>
  );
}

function BudgetGroup({
  title,
  accounts,
  budgetOf,
}: {
  title: string;
  accounts: Array<{ id: string; code: string; name: string }>;
  budgetOf: Map<string, number>;
}) {
  return (
    <div>
      <p className="label">{title}</p>
      <ul className="space-y-2">
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-sm text-ink-2">
              <span className="tnum mr-1.5 text-xs text-ink-3">{a.code}</span>
              {a.name}
            </span>
            <input
              type="number"
              name={`budget_${a.id}`}
              defaultValue={budgetOf.get(a.id) ?? 0}
              min={0}
              step={1000}
              className="field tnum w-[9rem] text-right"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
