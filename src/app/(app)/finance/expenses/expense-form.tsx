import Link from "next/link";
import { Card, CardTitle, Field } from "@/components/ui";
import {
  AmountInput,
  ConfirmSubmitButton,
  PhotoInput,
  SubmitButton,
} from "@/components/form";
import { PAYMENT_METHODS } from "@/lib/constants";
import { ymdDash } from "@/lib/format";
import type { AccountModel, ExpenseModel } from "@/generated/prisma/models";

export function ExpenseForm({
  action,
  accounts,
  expense,
  submitLabel,
  deleteAction,
}: {
  action: (formData: FormData) => void | Promise<void>;
  accounts: AccountModel[];
  expense?: ExpenseModel | null;
  submitLabel: string;
  deleteAction?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-5">
        <Card>
          <CardTitle>지출 내용</CardTitle>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="날짜" required>
                <input
                  type="date"
                  name="date"
                  className="field"
                  required
                  defaultValue={ymdDash(expense?.date) || ymdDash(new Date())}
                />
              </Field>
              <Field label="지출 항목" required>
                <select
                  name="accountId"
                  className="field"
                  required
                  defaultValue={expense?.accountId ?? ""}
                >
                  <option value="">선택하세요</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.category ? `[${a.category}] ` : ""}
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="금액" required>
              <AmountInput
                name="amount"
                defaultValue={expense?.amount ?? null}
                required
                autoFocus={!expense}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="지급처">
                <input
                  name="payee"
                  className="field"
                  placeholder="예) ○○문구, 한국전력"
                  defaultValue={expense?.payee ?? ""}
                />
              </Field>
              <Field label="지급 방법">
                <select
                  name="method"
                  className="field"
                  defaultValue={expense?.method ?? "TRANSFER"}
                >
                  {Object.entries(PAYMENT_METHODS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="적요 (무엇에 썼는지)">
              <input
                name="description"
                className="field"
                placeholder="예) 주일학교 교재 구입"
                defaultValue={expense?.description ?? ""}
              />
            </Field>

            <Field label="메모">
              <textarea
                name="note"
                rows={2}
                className="field"
                defaultValue={expense?.note ?? ""}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>영수증</CardTitle>
          <PhotoInput
            name="receipt"
            label="영수증 사진"
            currentUrl={expense?.receiptUrl ?? null}
            hint="휴대폰으로 영수증을 바로 찍어 올릴 수 있습니다. 회계 감사 때 근거자료가 됩니다."
          />
        </Card>

        <div className="flex items-center justify-end gap-2 pb-2">
          <Link href="/finance/expenses" className="btn btn-ghost">
            취소
          </Link>
          <SubmitButton>{submitLabel}</SubmitButton>
        </div>
      </form>

      {deleteAction && (
        <form action={deleteAction} className="flex justify-end">
          <ConfirmSubmitButton message="이 지출 기록을 삭제할까요? 되돌릴 수 없습니다.">
            이 기록 삭제
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
