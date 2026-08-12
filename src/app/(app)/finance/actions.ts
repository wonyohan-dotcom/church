"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth";
import { logAudit } from "@/lib/church";
import { deleteImage, saveImage } from "@/lib/upload";
import { parseDate, parseIntOr, str, won } from "@/lib/format";

/* ── 헌금(수입) ──────────────────────────── */

export async function createOffering(formData: FormData) {
  const user = await requireFinance();

  const date = parseDate(formData.get("date"));
  const amount = parseIntOr(formData.get("amount"));
  const accountId = str(formData.get("accountId"));

  if (!date || amount <= 0 || !accountId) {
    redirect("/finance/offerings/new?error=input");
  }

  const offering = await prisma.offering.create({
    data: {
      churchId: user.churchId,
      date,
      amount,
      accountId,
      memberId: str(formData.get("memberId")),
      donorName: str(formData.get("donorName")),
      method: str(formData.get("method")) ?? "CASH",
      note: str(formData.get("note")),
      createdById: user.id,
    },
    include: { account: true },
  });

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

  // '계속 입력'을 누르면 같은 날짜·과목으로 폼을 다시 열어 준다.
  if (formData.get("again") === "1") {
    redirect(
      `/finance/offerings/new?ok=1&date=${formData.get("date")}&accountId=${accountId}`,
    );
  }
  redirect("/finance/offerings?ok=created");
}

export async function updateOffering(id: string, formData: FormData) {
  const user = await requireFinance();

  const existing = await prisma.offering.findUnique({ where: { id } });
  if (!existing || existing.churchId !== user.churchId) redirect("/finance/offerings");

  const date = parseDate(formData.get("date"));
  const amount = parseIntOr(formData.get("amount"));
  const accountId = str(formData.get("accountId"));

  if (!date || amount <= 0 || !accountId) {
    redirect(`/finance/offerings/${id}?error=input`);
  }

  await prisma.offering.update({
    where: { id },
    data: {
      date,
      amount,
      accountId,
      memberId: str(formData.get("memberId")),
      donorName: str(formData.get("donorName")),
      method: str(formData.get("method")) ?? "CASH",
      note: str(formData.get("note")),
    },
  });

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
  redirect("/finance/offerings?ok=updated");
}

export async function deleteOffering(id: string) {
  const user = await requireFinance();

  const offering = await prisma.offering.findUnique({
    where: { id },
    include: { account: true },
  });
  if (!offering || offering.churchId !== user.churchId) redirect("/finance/offerings");

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
  redirect("/finance/offerings?ok=deleted");
}

/* ── 지출 ────────────────────────────────── */

export async function createExpense(formData: FormData) {
  const user = await requireFinance();

  const date = parseDate(formData.get("date"));
  const amount = parseIntOr(formData.get("amount"));
  const accountId = str(formData.get("accountId"));

  if (!date || amount <= 0 || !accountId) {
    redirect("/finance/expenses/new?error=input");
  }

  let receiptUrl: string | null = null;
  try {
    receiptUrl = await saveImage(formData.get("receipt"), "receipts");
  } catch {
    redirect("/finance/expenses/new?error=receipt");
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
  redirect("/finance/expenses?ok=created");
}

export async function updateExpense(id: string, formData: FormData) {
  const user = await requireFinance();

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing || existing.churchId !== user.churchId) redirect("/finance/expenses");

  const date = parseDate(formData.get("date"));
  const amount = parseIntOr(formData.get("amount"));
  const accountId = str(formData.get("accountId"));

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
  redirect("/finance/expenses?ok=updated");
}

export async function deleteExpense(id: string) {
  const user = await requireFinance();

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { account: true },
  });
  if (!expense || expense.churchId !== user.churchId) redirect("/finance/expenses");

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
  redirect("/finance/expenses?ok=deleted");
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
