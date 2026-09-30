"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth";
import { logAudit } from "@/lib/church";
import { parseDate, won, ymdDash } from "@/lib/format";
import type { ImportResult } from "../../members/import/actions";

const Row = z.object({
  line: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  direction: z.enum(["IN", "OUT"]),
  amount: z.number().int().positive().max(2_000_000_000),
  account: z.string().max(60).nullable(),
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
export async function importFinance(input: unknown): Promise<ImportResult & { newAccounts: string[] }> {
  const user = await requireFinance();
  const rows = z.array(Row).max(500).parse(input);
  const result = { created: 0, skipped: [] as ImportResult["skipped"], newAccounts: [] as string[] };
  if (rows.length === 0) return result;

  // 계정과목
  const accounts = await prisma.account.findMany({
    where: { churchId: user.churchId },
    select: { id: true, name: true, type: true, code: true },
  });
  const accountKey = (type: string, name: string) => `${type}|${name.replace(/\s/g, "")}`;
  const accountId = new Map(accounts.map((a) => [accountKey(a.type, a.name), a.id]));
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
    const offering = type === "INCOME" && /헌금|십일조|감사|선교|건축|구제|절기|주정/.test(name);
    const created = await prisma.account.create({
      data: {
        churchId: user.churchId,
        code,
        name,
        type,
        isOffering: offering,
        deductible: offering,
        category: "엑셀 가져오기",
      },
    });
    accounts.push({ id: created.id, name, type, code });
    accountId.set(accountKey(type, name), created.id);
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
      where: { churchId: user.churchId, date: { gte: from, lt: to } },
      select: { date: true, amount: true, accountId: true, memberId: true, donorName: true },
    }),
    prisma.expense.findMany({
      where: { churchId: user.churchId, date: { gte: from, lt: to } },
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
      const memberId = r.name ? (byName.get(r.name.replace(/\s/g, "")) ?? null) : null;
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
