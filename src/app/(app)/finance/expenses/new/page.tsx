import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth";
import { Alert, PageHeader } from "@/components/ui";
import { ExpenseForm } from "../expense-form";
import { createExpense } from "../../actions";
import { pendingAlert } from "@/lib/bank";
import { ymdDash } from "@/lib/format";

export const metadata = { title: "지출 입력" };

const ERRORS: Record<string, string> = {
  input: "날짜, 지출 항목, 금액(1원 이상)을 모두 올바르게 입력해 주세요.",
  receipt: "영수증 사진을 저장하지 못했습니다. 4MB 이하의 이미지인지 확인해 주세요.",
};

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; bank?: string }>;
}) {
  const staff = await requireFinance();
  const { error, bank } = await searchParams;
  // 입출금 알림함에서 "자세히 입력" 으로 넘어온 경우
  const alert = await pendingAlert(staff.churchId, bank, "OUT");

  const accounts = await prisma.account.findMany({
    where: { churchId: staff.churchId, type: "EXPENSE", active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <>
      <PageHeader
        title="지출 입력"
        description="영수증 사진을 함께 올려 두면 결산과 감사 때 근거자료로 쓸 수 있습니다."
        back={
          alert
            ? { href: "/finance/bank", label: "입출금 알림함" }
            : { href: "/finance/expenses", label: "지출 내역" }
        }
      />

      {error && (
        <div className="mb-5">
          <Alert tone="expense">{ERRORS[error] ?? "저장 중 문제가 발생했습니다."}</Alert>
        </div>
      )}

      <ExpenseForm
        action={createExpense}
        accounts={accounts}
        submitLabel="저장하기"
        bank={
          alert
            ? {
                id: alert.id,
                date: ymdDash(alert.occurredAt),
                amount: alert.amount,
                payee: alert.counterparty,
              }
            : null
        }
      />
    </>
  );
}
