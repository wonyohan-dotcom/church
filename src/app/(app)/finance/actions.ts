"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth";
import { logAudit } from "@/lib/church";
import { deleteImage, saveImage } from "@/lib/upload";
import { parseDate, parseIntOr, str, won } from "@/lib/format";
import { ownAccountId, ownMemberId } from "@/lib/tenant";
import { linkAlert, unlinkAlert } from "@/lib/bank";
import { autoLinkGivers, findLinkable, setGivers } from "@/lib/offering-givers";
import { backWith, safeBack } from "@/lib/back";

/** 입출금 알림함에서 넘어온 입력이면 에러 화면에서도 알림을 이어서 보여준다. */
function bankQuery(formData: FormData) {
  const id = str(formData.get("bankAlertId"));
  return id ? `&bank=${encodeURIComponent(id)}` : "";
}

/* ── 헌금(수입) ──────────────────────────── */

export async function createOffering(formData: FormData) {
  const user = await requireFinance();

  const date = parseDate(formData.get("date"));
  const amount = parseIntOr(formData.get("amount"));
  const accountId = await ownAccountId(user.churchId, str(formData.get("accountId")), "INCOME");
  const memberId = await ownMemberId(user.churchId, str(formData.get("memberId")));

  if (!date || amount <= 0 || !accountId) {
    redirect(`/finance/offerings/new?error=input${bankQuery(formData)}`);
  }

  const offering = await prisma.offering.create({
    data: {
      churchId: user.churchId,
      date,
      amount,
      accountId,
      memberId,
      donorName: str(formData.get("donorName")),
      method: str(formData.get("method")) ?? "CASH",
      note: str(formData.get("note")),
      createdById: user.id,
    },
    include: { account: true },
  });
  // 교인을 고르지 않고 이름만 적었으면 (예: "김동진최창일") 이름으로 교인을 찾아 잇는다.
  if (!memberId) await autoLinkGivers(user.churchId, offering.id, offering.donorName, accountId);

  await logAudit({
    churchId: user.churchId,
    action: "CREATE",
    entity: "Offering",
    entityId: offering.id,
    summary: `헌금 입력: ${offering.account.name} ${won(amount)}`,
    userId: user.id,
  });

  revalidatePath("/finance");
  revalidatePath("/finance/offerings");

  const bankAlertId = str(formData.get("bankAlertId"));
  if (bankAlertId) {
    await linkAlert(user.churchId, bankAlertId, { offeringId: offering.id });
    revalidatePath("/finance/bank");
    redirect("/finance/bank?ok=recorded");
  }

  // '계속 입력'을 누르면 같은 날짜·과목으로 폼을 다시 열어 준다.
  if (formData.get("again") === "1") {
    redirect(
      `/finance/offerings/new?ok=1&date=${formData.get("date")}&accountId=${accountId}`,
    );
  }
  redirect("/finance/offerings?ok=created");
}

export async function updateOffering(id: string, back: string | null, formData: FormData) {
  const user = await requireFinance();

  const existing = await prisma.offering.findUnique({
    where: { id },
    include: { coGivers: { select: { memberId: true } } },
  });
  if (!existing || existing.churchId !== user.churchId) redirect("/finance/offerings");

  const date = parseDate(formData.get("date"));
  const amount = parseIntOr(formData.get("amount"));
  const accountId = await ownAccountId(user.churchId, str(formData.get("accountId")), "INCOME");
  const memberId = await ownMemberId(user.churchId, str(formData.get("memberId")));

  if (!date || amount <= 0 || !accountId) {
    redirect(`/finance/offerings/${id}?error=input`);
  }

  await prisma.offering.update({
    where: { id },
    data: {
      date,
      amount,
      accountId,
      memberId,
      donorName: str(formData.get("donorName")),
      method: str(formData.get("method")) ?? "CASH",
      note: str(formData.get("note")),
    },
  });
  // 대표 헌금자를 바꿨으면: 함께 드린 교인은 그대로 두고, 교인을 비웠으면 무명으로.
  if (memberId !== existing.memberId) {
    const others = existing.coGivers.map((g) => g.memberId).filter((m) => m !== memberId);
    await setGivers(user.churchId, id, memberId ? [memberId, ...others] : [], { confirmed: true });
  }

  await logAudit({
    churchId: user.churchId,
    action: "UPDATE",
    entity: "Offering",
    entityId: id,
    summary: `헌금 수정: ${won(amount)}`,
    userId: user.id,
  });

  revalidatePath("/finance");
  revalidatePath("/finance/offerings");
  const to = safeBack(back);
  redirect(to ? backWith(to, "ok=updated") : "/finance/offerings?ok=updated");
}

export async function deleteOffering(id: string, back?: string | null) {
  const user = await requireFinance();

  const offering = await prisma.offering.findUnique({
    where: { id },
    include: { account: true },
  });
  if (!offering || offering.churchId !== user.churchId) redirect("/finance/offerings");

  await unlinkAlert({ offeringId: id });
  await prisma.offering.delete({ where: { id } });

  await logAudit({
    churchId: user.churchId,
    action: "DELETE",
    entity: "Offering",
    entityId: id,
    summary: `헌금 삭제: ${offering.account.name} ${won(offering.amount)}`,
    userId: user.id,
  });

  revalidatePath("/finance");
  revalidatePath("/finance/offerings");
  const to = safeBack(back);
  redirect(to ? backWith(to, "ok=deleted") : "/finance/offerings?ok=deleted");
}

/**
 * 헌금자를 고른다 (헌금 줄을 꾹 눌러 여는 창). ids[0] 이 대표, 나머지는 함께 드린 교인.
 * 빈 배열이면 무명으로 둔다.
 */
export async function setOfferingGivers(
  offeringId: string,
  memberIds: string[],
): Promise<{ ok: boolean }> {
  const user = await requireFinance();
  const offering = await prisma.offering.findFirst({
    where: { id: offeringId, churchId: user.churchId },
    include: { account: true },
  });
  if (!offering || !Array.isArray(memberIds)) return { ok: false };

  const ids = await setGivers(user.churchId, offeringId, memberIds.map(String).slice(0, 20), {
    confirmed: true,
  });
  const names = ids.length
    ? (await prisma.member.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }))
        .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
        .map((m) => m.name)
        .join(", ")
    : "무명";
  await logAudit({
    churchId: user.churchId,
    action: "UPDATE",
    entity: "Offering",
    entityId: offeringId,
    summary: `헌금자 지정: ${offering.account.name} ${won(offering.amount)} → ${names}`,
    userId: user.id,
  });

  revalidatePath("/finance/offerings");
  revalidatePath("/finance");
  for (const id of new Set([...ids, ...(offering.memberId ? [offering.memberId] : [])])) {
    revalidatePath(`/members/${id}`);
  }
  return { ok: true };
}

/**
 * 여러 헌금의 헌금자를 한꺼번에 정한다 (수입·지출 내역에서 검색 → 여러 건 선택).
 * ids[0] 이 대표, 나머지는 함께 드린 교인. 빈 배열이면 모두 무명.
 */
export async function setGiversBulk(
  offeringIds: string[],
  memberIds: string[],
): Promise<{ ok: boolean; count?: number }> {
  const user = await requireFinance();
  if (!Array.isArray(offeringIds) || !Array.isArray(memberIds) || offeringIds.length === 0) return { ok: false };
  const offerings = await prisma.offering.findMany({
    where: { id: { in: offeringIds.map(String).slice(0, 500) }, churchId: user.churchId },
    select: { id: true, memberId: true },
  });
  const unique = [...new Set(memberIds.map(String))].slice(0, 20);
  const members = unique.length
    ? await prisma.member.findMany({ where: { churchId: user.churchId, id: { in: unique } }, select: { id: true, name: true } })
    : [];
  const ids = unique.filter((id) => members.some((m) => m.id === id));
  const targets = offerings.map((o) => o.id);

  await prisma.$transaction([
    prisma.offering.updateMany({
      where: { id: { in: targets } },
      data: { memberId: ids[0] ?? null, giversConfirmed: true },
    }),
    prisma.offeringGiver.deleteMany({ where: { offeringId: { in: targets } } }),
    prisma.offeringGiver.createMany({
      data: targets.flatMap((offeringId) => ids.slice(1).map((memberId) => ({ offeringId, memberId }))),
    }),
  ]);

  const names = ids.map((id) => members.find((m) => m.id === id)?.name).join(", ") || "무명";
  await logAudit({
    churchId: user.churchId,
    action: "UPDATE",
    entity: "Offering",
    summary: `헌금자 한꺼번에 지정: ${targets.length}건 → ${names}`,
    userId: user.id,
  });
  revalidatePath("/finance/ledger");
  revalidatePath("/finance/offerings");
  revalidatePath("/finance");
  for (const id of new Set([...ids, ...offerings.map((o) => o.memberId).filter((v): v is string => !!v)])) {
    revalidatePath(`/members/${id}`);
  }
  return { ok: true, count: targets.length };
}

/** 적힌 이름으로 교인을 찾아, 고른 묶음을 한꺼번에 잇는다. */
export async function linkOfferingsByName(formData: FormData) {
  const user = await requireFinance();
  const picked = new Set(formData.getAll("name").map(String));
  const groups = (await findLinkable(user.churchId)).filter((g) => picked.has(g.donorName));

  let count = 0;
  for (const g of groups) {
    const [lead, ...rest] = g.memberIds;
    await prisma.$transaction([
      prisma.offering.updateMany({
        where: { id: { in: g.offeringIds }, churchId: user.churchId, memberId: null },
        data: { memberId: lead },
      }),
      prisma.offeringGiver.createMany({
        data: g.offeringIds.flatMap((offeringId) => rest.map((memberId) => ({ offeringId, memberId }))),
        skipDuplicates: true,
      }),
    ]);
    count += g.offeringIds.length;
  }

  if (count) {
    await logAudit({
      churchId: user.churchId,
      action: "UPDATE",
      entity: "Offering",
      summary: `이름으로 헌금자 연결: ${count}건`,
      userId: user.id,
    });
  }
  revalidatePath("/finance/offerings");
  revalidatePath("/finance");
  redirect(`/finance/offerings/link?ok=${count}`);
}

/* ── 지출 ────────────────────────────────── */

export async function createExpense(formData: FormData) {
  const user = await requireFinance();

  const date = parseDate(formData.get("date"));
  const amount = parseIntOr(formData.get("amount"));
  const accountId = await ownAccountId(user.churchId, str(formData.get("accountId")), "EXPENSE");

  if (!date || amount <= 0 || !accountId) {
    redirect(`/finance/expenses/new?error=input${bankQuery(formData)}`);
  }

  let receiptUrl: string | null = null;
  try {
    receiptUrl = await saveImage(formData.get("receipt"), "receipts");
  } catch {
    redirect(`/finance/expenses/new?error=receipt${bankQuery(formData)}`);
  }

  const expense = await prisma.expense.create({
    data: {
      churchId: user.churchId,
      date,
      amount,
      accountId,
      payee: str(formData.get("payee")),
      method: str(formData.get("method")) ?? "TRANSFER",
      description: str(formData.get("description")),
      note: str(formData.get("note")),
      receiptUrl,
      createdById: user.id,
    },
    include: { account: true },
  });

  await logAudit({
    churchId: user.churchId,
    action: "CREATE",
    entity: "Expense",
    entityId: expense.id,
    summary: `지출 입력: ${expense.account.name} ${won(amount)}`,
    userId: user.id,
  });

  revalidatePath("/finance");
  revalidatePath("/finance/expenses");

  const bankAlertId = str(formData.get("bankAlertId"));
  if (bankAlertId) {
    await linkAlert(user.churchId, bankAlertId, { expenseId: expense.id });
    revalidatePath("/finance/bank");
    redirect("/finance/bank?ok=recorded");
  }
  redirect("/finance/expenses?ok=created");
}

export async function updateExpense(id: string, back: string | null, formData: FormData) {
  const user = await requireFinance();

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing || existing.churchId !== user.churchId) redirect("/finance/expenses");

  const date = parseDate(formData.get("date"));
  const amount = parseIntOr(formData.get("amount"));
  const accountId = await ownAccountId(user.churchId, str(formData.get("accountId")), "EXPENSE");

  if (!date || amount <= 0 || !accountId) {
    redirect(`/finance/expenses/${id}?error=input`);
  }

  const current = await prisma.expense.findUnique({ where: { id } });
  if (!current) redirect("/finance/expenses");

  let receiptUrl = current.receiptUrl;
  try {
    const uploaded = await saveImage(formData.get("receipt"), "receipts");
    if (uploaded) {
      await deleteImage(current.receiptUrl);
      receiptUrl = uploaded;
    } else if (formData.get("receipt_remove") === "1") {
      await deleteImage(current.receiptUrl);
      receiptUrl = null;
    }
  } catch {
    redirect(`/finance/expenses/${id}?error=receipt`);
  }

  await prisma.expense.update({
    where: { id },
    data: {
      date,
      amount,
      accountId,
      payee: str(formData.get("payee")),
      method: str(formData.get("method")) ?? "TRANSFER",
      description: str(formData.get("description")),
      note: str(formData.get("note")),
      receiptUrl,
    },
  });

  await logAudit({
    churchId: user.churchId,
    action: "UPDATE",
    entity: "Expense",
    entityId: id,
    summary: `지출 수정: ${won(amount)}`,
    userId: user.id,
  });

  revalidatePath("/finance");
  revalidatePath("/finance/expenses");
  const to = safeBack(back);
  redirect(to ? backWith(to, "ok=updated") : "/finance/expenses?ok=updated");
}

export async function deleteExpense(id: string, back?: string | null) {
  const user = await requireFinance();

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { account: true },
  });
  if (!expense || expense.churchId !== user.churchId) redirect("/finance/expenses");

  await unlinkAlert({ expenseId: id });
  await prisma.expense.delete({ where: { id } });
  await deleteImage(expense.receiptUrl);

  await logAudit({
    churchId: user.churchId,
    action: "DELETE",
    entity: "Expense",
    entityId: id,
    summary: `지출 삭제: ${expense.account.name} ${won(expense.amount)}`,
    userId: user.id,
  });

  revalidatePath("/finance");
  revalidatePath("/finance/expenses");
  const to = safeBack(back);
  redirect(to ? backWith(to, "ok=deleted") : "/finance/expenses?ok=deleted");
}

/* ── 계정과목 ────────────────────────────── */

export async function createAccount(formData: FormData) {
  const user = await requireFinance();

  const code = str(formData.get("code"));
  const name = str(formData.get("name"));
  const type = str(formData.get("type")) ?? "INCOME";

  if (!code || !name) redirect("/finance/accounts?error=input");

  const duplicate = await prisma.account.findUnique({
    where: { churchId_code: { churchId: user.churchId, code } },
  });
  if (duplicate) redirect("/finance/accounts?error=duplicate");

  await prisma.account.create({
    data: {
      churchId: user.churchId,
      code,
      name,
      type,
      category: str(formData.get("category")),
      isOffering: formData.get("isOffering") === "1",
      deductible: formData.get("deductible") === "1",
    },
  });

  await logAudit({
    churchId: user.churchId,
    action: "CREATE",
    entity: "Account",
    summary: `계정과목 추가: ${code} ${name}`,
    userId: user.id,
  });

  revalidatePath("/finance/accounts");
  redirect("/finance/accounts?ok=created");
}

export async function toggleAccountActive(id: string) {
  const user = await requireFinance();
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || account.churchId !== user.churchId) return;

  await prisma.account.update({
    where: { id },
    data: { active: !account.active },
  });

  revalidatePath("/finance/accounts");
}

export async function deleteAccount(id: string) {
  const user = await requireFinance();

  const account = await prisma.account.findUnique({
    where: { id },
    select: {
      code: true,
      name: true,
      churchId: true,
      _count: { select: { offerings: true, expenses: true } },
    },
  });
  if (!account || account.churchId !== user.churchId) redirect("/finance/accounts");

  // 이미 쓰인 과목을 지우면 과거 장부가 깨진다. 대신 '사용 안 함'으로 돌린다.
  if (account._count.offerings > 0 || account._count.expenses > 0) {
    redirect("/finance/accounts?error=in-use");
  }

  await prisma.account.delete({ where: { id } });

  await logAudit({
    churchId: user.churchId,
    action: "DELETE",
    entity: "Account",
    summary: `계정과목 삭제: ${account.code} ${account.name}`,
    userId: user.id,
  });

  revalidatePath("/finance/accounts");
  redirect("/finance/accounts?ok=deleted");
}

/* ── 예산 ────────────────────────────────── */

export async function saveBudget(year: number, formData: FormData) {
  const user = await requireFinance();

  const accounts = await prisma.account.findMany({
    where: { churchId: user.churchId },
    select: { id: true },
  });

  await prisma.$transaction(
    accounts.map((a) => {
      const amount = parseIntOr(formData.get(`budget_${a.id}`));
      return prisma.budget.upsert({
        where: { year_accountId: { year, accountId: a.id } },
        update: { amount },
        create: { churchId: user.churchId, year, accountId: a.id, amount },
      });
    }),
  );

  await logAudit({
    churchId: user.churchId,
    action: "UPDATE",
    entity: "Budget",
    summary: `${year}년 예산 저장`,
    userId: user.id,
  });

  revalidatePath("/finance/report");
  redirect(`/finance/report?year=${year}&ok=budget`);
}
