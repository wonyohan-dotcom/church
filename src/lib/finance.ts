import { prisma } from "./prisma";

export function yearRange(year: number) {
  return { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) };
}

export function monthRange(year: number, month: number) {
  return { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) };
}

export type YearSummary = {
  year: number;
  monthly: Array<{ label: string; month: number; income: number; expense: number }>;
  totalIncome: number;
  totalExpense: number;
  incomeByAccount: Array<{ id: string; name: string; amount: number }>;
  expenseByAccount: Array<{ id: string; name: string; amount: number }>;
};

/**
 * 한 해의 수입·지출을 월별·계정과목별로 집계한다.
 * 한 교회의 연간 거래 건수는 많아야 수천 건이라 DB에서 원장을 읽어 JS에서 합산한다.
 */
export async function getYearSummary(year: number): Promise<YearSummary> {
  const range = yearRange(year);

  const [offerings, expenses, accounts] = await Promise.all([
    prisma.offering.findMany({
      where: { date: range },
      select: { date: true, amount: true, accountId: true },
    }),
    prisma.expense.findMany({
      where: { date: range },
      select: { date: true, amount: true, accountId: true },
    }),
    prisma.account.findMany({ select: { id: true, name: true, sortOrder: true } }),
  ]);

  const nameOf = new Map(accounts.map((a) => [a.id, a.name]));

  const monthly = Array.from({ length: 12 }, (_, i) => ({
    label: `${i + 1}월`,
    month: i + 1,
    income: 0,
    expense: 0,
  }));

  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  for (const o of offerings) {
    monthly[o.date.getMonth()].income += o.amount;
    incomeMap.set(o.accountId, (incomeMap.get(o.accountId) ?? 0) + o.amount);
  }
  for (const e of expenses) {
    monthly[e.date.getMonth()].expense += e.amount;
    expenseMap.set(e.accountId, (expenseMap.get(e.accountId) ?? 0) + e.amount);
  }

  const toList = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([id, amount]) => ({ id, name: nameOf.get(id) ?? "(삭제된 과목)", amount }))
      .sort((a, b) => b.amount - a.amount);

  return {
    year,
    monthly,
    totalIncome: offerings.reduce((s, o) => s + o.amount, 0),
    totalExpense: expenses.reduce((s, e) => s + e.amount, 0),
    incomeByAccount: toList(incomeMap),
    expenseByAccount: toList(expenseMap),
  };
}

/** 특정 교인의 해당 연도 헌금을 계정과목별로 묶는다. 기부금영수증 명세에 쓰인다. */
export async function getMemberYearOfferings(memberId: string, year: number) {
  const offerings = await prisma.offering.findMany({
    where: { memberId, date: yearRange(year) },
    include: { account: true },
    orderBy: { date: "asc" },
  });

  const groups = new Map<
    string,
    { accountName: string; deductible: boolean; amount: number; count: number }
  >();

  for (const o of offerings) {
    const key = o.account.id;
    const g = groups.get(key) ?? {
      accountName: o.account.name,
      deductible: o.account.deductible,
      amount: 0,
      count: 0,
    };
    g.amount += o.amount;
    g.count += 1;
    groups.set(key, g);
  }

  const items = [...groups.values()].sort((a, b) => b.amount - a.amount);
  const deductibleTotal = items
    .filter((i) => i.deductible)
    .reduce((s, i) => s + i.amount, 0);

  return { offerings, items, deductibleTotal, total: offerings.reduce((s, o) => s + o.amount, 0) };
}
