"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireFinance } from "@/lib/auth";
import { logAudit } from "@/lib/church";
import { parseDate, won, ymdDash } from "@/lib/format";
import type { ImportResult } from "../../members/import/actions";

const Row = z.object({
  line: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  direction: z.enum(["IN", "OUT"]),
  amount: z.number().int().positive().max(2_000_000_000),
  account: z.string().max(60).nullable(),
  category: z.string().max(40).nullable().optional(),
  name: z.string().max(60).nullable(),
  payee: z.string().max(100).nullable(),
  description: z.string().max(500).nullable(),
  method: z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]).nullable(),
});

const FALLBACK = { IN: "기타수입", OUT: "기타지출" } as const;

/**
 * 수입(헌금)·지출을 한 번에 입력한다. (한 번에 최대 500줄)
 * - 항목 이름으로 계정과목을 찾고, 없으면 새로 만든다. 항목이 비어 있으면 기타수입/기타지출.
 * - 헌금자 이름과 똑같은 교인이 한 명뿐이면 그 교인의 헌금으로 연결한다(기부금영수증에 반영).
 * - 같은 날짜·금액·항목·이름의 기록이 이미 있으면 건너뛴다. 같은 파일을 두 번 올려도 두 번 들어가지 않는다.
 */
export async function importFinance(
  input: unknown,
  opts: { since?: string } = {},
): Promise<ImportResult & { newAccounts: string[] }> {
  const user = await requireFinance();
  const rows = z.array(Row).max(500).parse(input);
  // 여러 번에 나눠 보낼 때, 이번에 먼저 보낸 줄을 "이미 있는 기록"으로 오해하지 않도록
  // 가져오기를 시작하기 전에 있던 기록하고만 겹치는지 본다.
  const since = opts.since ? new Date(opts.since) : null;
  const before = since && !Number.isNaN(since.getTime()) ? { createdAt: { lt: since } } : {};
  const result = { created: 0, skipped: [] as ImportResult["skipped"], newAccounts: [] as string[] };
  if (rows.length === 0) return result;

  // 계정과목
  const accounts = await prisma.account.findMany({
    where: { churchId: user.churchId },
    select: { id: true, name: true, type: true, code: true, isOffering: true },
  });
  const accountKey = (type: string, name: string) => `${type}|${name.replace(/\s/g, "")}`;
  const accountId = new Map(accounts.map((a) => [accountKey(a.type, a.name), a.id]));
  // 헌금 항목에만 교인을 연결한다. 목사님 개인 계좌에서 옮긴 내부이체가
  // 그분의 헌금으로 잡혀 기부금영수증에 들어가면 안 된다.
  const givingAccount = new Set(accounts.filter((a) => a.isOffering).map((a) => a.id));
  const nextCode = (type: "INCOME" | "EXPENSE") => {
    const prefix = type === "INCOME" ? "1" : "2";
    const nums = accounts.filter((a) => a.code.startsWith(prefix)).map((a) => Number(a.code) || 0);
    let n = Math.max(Number(`${prefix}000`), ...nums) + 1;
    while (accounts.some((a) => a.code === String(n))) n++;
    return String(n);
  };
  for (const r of rows) {
    const type = r.direction === "IN" ? "INCOME" : "EXPENSE";
    const name = r.account ?? FALLBACK[r.direction];
    if (accountId.has(accountKey(type, name))) continue;
    const code = nextCode(type);
    // 계좌 사이 이체·환불·이자는 헌금이 아니므로 기부금영수증에서 뺀다.
    const notGiving = /내부이체|환불|취소|이자/.test(name);
    const offering = type === "INCOME" && !notGiving && /헌금|십일조|감사|선교|건축|구제|절기|주정/.test(name);
    // 같은 이름이 수입·지출 양쪽에 있을 수 있으므로(내부이체 등) 같은 방향의 줄에서 분류를 찾는다.
    const category =
      rows.find((x) => x.direction === r.direction && (x.account ?? FALLBACK[x.direction]) === name && x.category)
        ?.category ?? "엑셀 가져오기";
    const created = await prisma.account.create({
      data: {
        churchId: user.churchId,
        code,
        name,
        type,
        isOffering: offering,
        deductible: offering,
        category,
      },
    });
    accounts.push({ id: created.id, name, type, code, isOffering: offering });
    accountId.set(accountKey(type, name), created.id);
    if (offering) givingAccount.add(created.id);
    result.newAccounts.push(`${type === "INCOME" ? "수입" : "지출"} · ${name}`);
  }

  // 헌금자 이름 → 교인 (동명이인이 없을 때만)
  const members = await prisma.member.findMany({
    where: { churchId: user.churchId },
    select: { id: true, name: true },
  });
  const byName = new Map<string, string | null>();
  for (const m of members) byName.set(m.name, byName.has(m.name) ? null : m.id);

  // 이미 있는 기록(같은 기간)과 겹치는지. 같은 내용이 여러 번 있을 수 있으니 개수로 센다.
  const dates = rows.map((r) => r.date).sort();
  const from = parseDate(dates[0])!;
  const to = parseDate(dates[dates.length - 1])!;
  to.setDate(to.getDate() + 1);
  const [oldOfferings, oldExpenses] = await Promise.all([
    prisma.offering.findMany({
      where: { churchId: user.churchId, date: { gte: from, lt: to }, ...before },
      select: { date: true, amount: true, accountId: true, memberId: true, donorName: true },
    }),
    prisma.expense.findMany({
      where: { churchId: user.churchId, date: { gte: from, lt: to }, ...before },
      select: { date: true, amount: true, accountId: true, payee: true },
    }),
  ]);
  const counts = new Map<string, number>();
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const o of oldOfferings) bump(`IN|${ymdDash(o.date)}|${o.amount}|${o.accountId}|${o.memberId ?? o.donorName ?? ""}`);
  for (const e of oldExpenses) bump(`OUT|${ymdDash(e.date)}|${e.amount}|${e.accountId}|${e.payee ?? ""}`);

  const offerings = [];
  const expenses = [];
  for (const r of rows) {
    const type = r.direction === "IN" ? "INCOME" : "EXPENSE";
    const acc = accountId.get(accountKey(type, r.account ?? FALLBACK[r.direction]))!;
    const date = parseDate(r.date)!;
    if (r.direction === "IN") {
      const memberId =
        r.name && givingAccount.has(acc) ? (byName.get(r.name.replace(/\s/g, "")) ?? null) : null;
      const key = `IN|${r.date}|${r.amount}|${acc}|${memberId ?? r.name ?? ""}`;
      if ((counts.get(key) ?? 0) > 0) {
        counts.set(key, counts.get(key)! - 1);
        result.skipped.push({ line: r.line, reason: "이미 입력된 헌금" });
        continue;
      }
      offerings.push({
        churchId: user.churchId,
        date,
        amount: r.amount,
        accountId: acc,
        memberId,
        donorName: memberId ? null : r.name,
        method: r.method ?? "CASH",
        note: r.description,
        createdById: user.id,
      });
    } else {
      const payee = r.payee ?? r.name;
      const key = `OUT|${r.date}|${r.amount}|${acc}|${payee ?? ""}`;
      if ((counts.get(key) ?? 0) > 0) {
        counts.set(key, counts.get(key)! - 1);
        result.skipped.push({ line: r.line, reason: "이미 입력된 지출" });
        continue;
      }
      expenses.push({
        churchId: user.churchId,
        date,
        amount: r.amount,
        accountId: acc,
        payee,
        description: r.description,
        method: r.method ?? "TRANSFER",
        createdById: user.id,
      });
    }
  }

  if (offerings.length) await prisma.offering.createMany({ data: offerings });
  if (expenses.length) await prisma.expense.createMany({ data: expenses });
  result.created = offerings.length + expenses.length;

  if (result.created) {
    const sum = (list: { amount: number }[]) => list.reduce((s, x) => s + x.amount, 0);
    await logAudit({
      churchId: user.churchId,
      action: "CREATE",
      entity: "Import",
      summary: `엑셀로 수입 ${offerings.length}건(${won(sum(offerings))}) · 지출 ${expenses.length}건(${won(sum(expenses))}) 입력`,
      userId: user.id,
    });
    for (const p of ["/finance", "/finance/offerings", "/finance/expenses", "/dashboard", "/receipts"]) {
      revalidatePath(p);
    }
  }
  return result;
}


/**
 * 장부를 통째로 새 파일로 바꿀 때, 먼저 기존 수입·지출을 모두 지운다. (관리자만)
 * - 이미 발급한 기부금영수증은 발급 당시 금액이 따로 저장되어 있어 그대로 남는다.
 * - 은행 알림함의 기록은 새 파일에 이미 들어 있으므로 '장부와 무관'으로 돌려,
 *   같은 거래가 다시 추천되지 않게 한다. (같은 문자가 다시 와도 중복으로 걸러진다)
 */
export async function clearFinance(): Promise<{ offerings: number; expenses: number }> {
  const user = await requireAdmin();
  const [o, e] = await prisma.$transaction([
    prisma.offering.deleteMany({ where: { churchId: user.churchId } }),
    prisma.expense.deleteMany({ where: { churchId: user.churchId } }),
    prisma.bankAlert.updateMany({
      where: { churchId: user.churchId, status: { in: ["PENDING", "RECORDED"] } },
      data: { status: "IGNORED" },
    }),
  ]);
  await logAudit({
    churchId: user.churchId,
    action: "DELETE",
    entity: "Import",
    summary: `엑셀로 새로 채우기 전에 기존 수입 ${o.count}건 · 지출 ${e.count}건 삭제`,
    userId: user.id,
  });
  return { offerings: o.count, expenses: e.count };
}
