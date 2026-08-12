import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff, canManageFinance } from "@/lib/auth";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { won, ymd } from "@/lib/format";
import { Alert, Card, EmptyState, PageHeader, StatCard, TableWrap } from "@/components/ui";
import { IconPlus, IconReceipt, IconWallet } from "@/components/icons";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "지출 내역" };

const PAGE_SIZE = 50;

const MESSAGES: Record<string, string> = {
  created: "지출이 입력되었습니다.",
  updated: "지출 내역이 수정되었습니다.",
  deleted: "지출 내역이 삭제되었습니다.",
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    account?: string;
    page?: string;
    ok?: string;
  }>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;

  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = sp.month ? Number(sp.month) : 0;
  const accountId = sp.account ?? "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const dateFilter =
    month > 0
      ? { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) }
      : { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) };

  const where: Prisma.ExpenseWhereInput = {
    churchId: staff.churchId,
    date: dateFilter,
    ...(accountId ? { accountId } : {}),
  };

  const [expenses, total, sum, accounts] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { account: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
    prisma.account.findMany({
      where: { churchId: staff.churchId, type: "EXPENSE" },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canEdit = canManageFinance(staff.role);
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  function hrefWith(patch: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    const merged = { year, month, account: accountId, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "" && v !== 0) params.set(k, String(v));
    }
    const s = params.toString();
    return `/finance/expenses${s ? `?${s}` : ""}`;
  }

  return (
    <>
      <PageHeader
        title="지출 내역"
        description="교회 지출을 기록하고 영수증 사진을 함께 보관합니다."
        back={{ href: "/finance", label: "회계 관리" }}
        actions={
          canEdit && (
            <Link href="/finance/expenses/new" className="btn btn-primary">
              <IconPlus width={16} height={16} />
              지출 입력
            </Link>
          )
        }
      />

      {sp.ok && MESSAGES[sp.ok] && (
        <div className="mb-5">
          <Alert tone="income">{MESSAGES[sp.ok]}</Alert>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatCard label="조회 건수" value={`${total.toLocaleString("ko-KR")}건`} />
        <StatCard label="합계 금액" value={won(sum._sum.amount ?? 0)} tone="expense" />
      </div>

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
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
        <div className="w-[7rem]">
          <label className="label" htmlFor="month">
            월
          </label>
          <select id="month" name="month" defaultValue={String(month)} className="field">
            <option value="0">전체</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[9rem] flex-1">
          <label className="label" htmlFor="account">
            지출 항목
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
      </form>

      {expenses.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconWallet />}
            title="해당 기간에 지출 기록이 없습니다"
            action={
              canEdit && (
                <Link href="/finance/expenses/new" className="btn btn-primary">
                  <IconPlus width={16} height={16} />
                  지출 입력
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="hidden sm:block">
            <TableWrap>
              <table className="table">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>항목</th>
                    <th>적요 / 지급처</th>
                    <th>방법</th>
                    <th className="text-right">금액</th>
                    <th>영수증</th>
                    {canEdit && <th />}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="tnum whitespace-nowrap text-ink-2">{ymd(e.date)}</td>
                      <td className="font-medium text-ink">{e.account.name}</td>
                      <td className="max-w-[16rem] truncate text-ink-2">
                        {e.description ?? "-"}
                        {e.payee && <span className="block text-xs text-ink-3">{e.payee}</span>}
                      </td>
                      <td className="text-ink-3">
                        {PAYMENT_METHODS[e.method as PaymentMethod] ?? e.method}
                      </td>
                      <td className="tnum whitespace-nowrap text-right font-semibold text-ink">
                        {won(e.amount)}
                      </td>
                      <td>
                        {e.receiptUrl ? (
                          <a
                            href={e.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                          >
                            <IconReceipt width={15} height={15} />
                            보기
                          </a>
                        ) : (
                          <span className="text-xs text-ink-3">없음</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="text-right">
                          <Link
                            href={`/finance/expenses/${e.id}`}
                            className="text-sm font-semibold text-primary hover:underline"
                          >
                            수정
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>

          <ul className="card divide-y divide-line sm:hidden">
            {expenses.map((e) => (
              <li key={e.id}>
                <Link
                  href={canEdit ? `/finance/expenses/${e.id}` : "#"}
                  className="flex items-center gap-3 p-3.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {e.account.name}
                    </span>
                    <span className="tnum block truncate text-xs text-ink-3">
                      {ymd(e.date)}
                      {e.payee && ` · ${e.payee}`}
                    </span>
                  </span>
                  {e.receiptUrl && (
                    <IconReceipt width={16} height={16} className="shrink-0 text-ink-3" />
                  )}
                  <span className="tnum shrink-0 text-sm font-semibold text-expense">
                    {won(e.amount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
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
    </>
  );
}
