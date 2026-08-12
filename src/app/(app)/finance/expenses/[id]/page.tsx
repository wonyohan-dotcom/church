import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth";
import { Alert, PageHeader } from "@/components/ui";
import { ExpenseForm } from "../expense-form";
import { deleteExpense, updateExpense } from "../../actions";

export const metadata = { title: "지출 수정" };

const ERRORS: Record<string, string> = {
  input: "날짜, 지출 항목, 금액(1원 이상)을 모두 올바르게 입력해 주세요.",
  receipt: "영수증 사진을 저장하지 못했습니다. 8MB 이하의 이미지인지 확인해 주세요.",
};

export default async function EditExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireFinance();
  const { id } = await params;
  const { error } = await searchParams;

  const [expense, accounts] = await Promise.all([
    prisma.expense.findUnique({ where: { id } }),
    prisma.account.findMany({ where: { type: "EXPENSE" }, orderBy: { sortOrder: "asc" } }),
  ]);

  if (!expense) notFound();

  return (
    <>
      <PageHeader title="지출 수정" back={{ href: "/finance/expenses", label: "지출 내역" }} />

      {error && (
        <div className="mb-5">
          <Alert tone="expense">{ERRORS[error] ?? "저장 중 문제가 발생했습니다."}</Alert>
        </div>
      )}

      <ExpenseForm
        action={updateExpense.bind(null, expense.id)}
        deleteAction={deleteExpense.bind(null, expense.id)}
        accounts={accounts}
        expense={expense}
        submitLabel="저장하기"
      />
    </>
  );
}
