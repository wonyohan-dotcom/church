"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth";
import { str } from "@/lib/format";
import { ownAccountId, ownMemberId } from "@/lib/tenant";
import { ingestBankText, newBankToken, recordAlert, suggestFor } from "@/lib/bank";

async function ownAlert(churchId: string, id: string) {
  const alert = await prisma.bankAlert.findFirst({ where: { id, churchId } });
  if (!alert) redirect("/finance/bank");
  return alert;
}

function refresh() {
  revalidatePath("/finance/bank");
  revalidatePath("/finance");
  revalidatePath("/finance/offerings");
  revalidatePath("/finance/expenses");
}

/** 알림함 카드에서 항목(과 교인)을 고르고 바로 기록 */
export async function recordBankAlert(id: string, formData: FormData) {
  const user = await requireFinance();
  const alert = await ownAlert(user.churchId, id);

  const type = alert.direction === "IN" ? "INCOME" : "EXPENSE";
  const accountId = await ownAccountId(user.churchId, str(formData.get("accountId")), type);
  if (!accountId) redirect(`/finance/bank?error=account#a-${id}`);

  const memberId =
    alert.direction === "IN"
      ? await ownMemberId(user.churchId, str(formData.get("memberId")))
      : null;

  const done = await recordAlert(alert, {
    accountId,
    memberId,
    userId: user.id,
    description: str(formData.get("description")),
  });
  refresh();
  redirect(`/finance/bank?ok=${done ? "recorded" : "already"}`);
}

/** 추천이 있을 때 한 번에 기록 */
export async function quickRecordBankAlert(id: string) {
  const user = await requireFinance();
  const alert = await ownAlert(user.churchId, id);
  const s = await suggestFor(alert);
  if (!s.accountId) redirect(`/finance/bank?error=account#a-${id}`);
  const done = await recordAlert(alert, { accountId: s.accountId, memberId: s.memberId, userId: user.id });
  refresh();
  redirect(`/finance/bank?ok=${done ? "recorded" : "already"}`);
}

export async function ignoreBankAlert(id: string) {
  const user = await requireFinance();
  await prisma.bankAlert.updateMany({
    where: { id, churchId: user.churchId, status: "PENDING" },
    data: { status: "IGNORED" },
  });
  refresh();
  redirect("/finance/bank?ok=ignored");
}

/** 무시했던 알림, 또는 연결된 기록을 지운 알림을 다시 대기로 돌린다. */
export async function reopenBankAlert(id: string) {
  const user = await requireFinance();
  const alert = await ownAlert(user.churchId, id);
  if (alert.status === "IGNORED" || (!alert.offeringId && !alert.expenseId)) {
    await prisma.bankAlert.update({ where: { id }, data: { status: "PENDING" } });
  }
  refresh();
  redirect("/finance/bank");
}

export async function deleteBankAlert(id: string) {
  const user = await requireFinance();
  await prisma.bankAlert.deleteMany({ where: { id, churchId: user.churchId } });
  refresh();
  redirect("/finance/bank?tab=done&ok=deleted");
}

/** 은행 문자를 직접 붙여넣어 알림함에 넣는다. (단축어 없이도 쓸 수 있게) */
export async function pasteBankMessages(formData: FormData) {
  const user = await requireFinance();
  const text = String(formData.get("text") ?? "").slice(0, 20000);
  if (!text.trim()) redirect("/finance/bank?error=empty");

  const r = await ingestBankText(user.churchId, text, "MANUAL");
  refresh();
  redirect(
    `/finance/bank?ok=pasted&saved=${r.saved.length}&dup=${r.duplicates}&bad=${r.unreadable}`,
  );
}

/* ── 설정 ───────────────────────────────── */

export async function enableBankInbox() {
  const user = await requireFinance();
  const church = await prisma.church.findUnique({
    where: { id: user.churchId },
    select: { bankToken: true },
  });
  if (!church?.bankToken) {
    await prisma.church.update({
      where: { id: user.churchId },
      data: { bankToken: newBankToken() },
    });
  }
  revalidatePath("/finance/bank/setup");
  redirect("/finance/bank/setup?ok=enabled#step-2");
}

/** 주소가 새어 나갔을 때. 새 주소를 만들면 이전 주소는 바로 막힌다. */
export async function regenerateBankToken() {
  const user = await requireFinance();
  await prisma.church.update({
    where: { id: user.churchId },
    data: { bankToken: newBankToken() },
  });
  revalidatePath("/finance/bank/setup");
  redirect("/finance/bank/setup?ok=regenerated#step-2");
}

export async function disableBankInbox() {
  const user = await requireFinance();
  await prisma.church.update({ where: { id: user.churchId }, data: { bankToken: null } });
  revalidatePath("/finance/bank/setup");
  redirect("/finance/bank/setup?ok=disabled");
}

export async function saveBankOptions(formData: FormData) {
  const user = await requireFinance();
  const accountId = await ownAccountId(user.churchId, str(formData.get("incomeAccountId")), "INCOME");
  await prisma.church.update({
    where: { id: user.churchId },
    data: {
      bankAutoRecord: formData.get("autoRecord") === "1",
      bankIncomeAccountId: accountId,
    },
  });
  revalidatePath("/finance/bank/setup");
  redirect("/finance/bank/setup?ok=saved#options");
}
