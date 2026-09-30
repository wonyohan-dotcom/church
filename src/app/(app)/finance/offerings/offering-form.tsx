import Link from "next/link";
import { Card, CardTitle, Field } from "@/components/ui";
import { AmountInput, ConfirmSubmitButton, SubmitButton } from "@/components/form";
import { MemberPicker, type PickableMember } from "@/components/member-picker";
import { PAYMENT_METHODS } from "@/lib/constants";
import { ymdDash } from "@/lib/format";
import type { AccountModel, OfferingModel } from "@/generated/prisma/models";

export function OfferingForm({
  action,
  accounts,
  members,
  offering,
  defaultMember,
  defaultDate,
  defaultAccountId,
  submitLabel,
  deleteAction,
  showRepeat,
  bank,
}: {
  action: (formData: FormData) => void | Promise<void>;
  accounts: AccountModel[];
  members: PickableMember[];
  offering?: OfferingModel | null;
  defaultMember?: PickableMember | null;
  defaultDate?: string;
  defaultAccountId?: string;
  submitLabel: string;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  showRepeat?: boolean;
  /** 입출금 알림함에서 넘어온 경우: 알림 내용으로 칸을 채우고, 저장하면 알림과 연결한다. */
  bank?: { id: string; date: string; amount: number; donorName: string | null } | null;
}) {
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-5">
        {bank && <input type="hidden" name="bankAlertId" value={bank.id} />}
        <Card>
          <CardTitle>헌금 내용</CardTitle>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="날짜" required>
                <input
                  type="date"
                  name="date"
                  className="field"
                  required
                  defaultValue={
                    ymdDash(offering?.date) || bank?.date || defaultDate || ymdDash(new Date())
                  }
                />
              </Field>
              <Field label="헌금 항목" required>
                <select
                  name="accountId"
                  className="field"
                  required
                  defaultValue={offering?.accountId ?? defaultAccountId ?? ""}
                >
                  <option value="">선택하세요</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="금액" required>
              <AmountInput
                name="amount"
                defaultValue={offering?.amount ?? bank?.amount ?? null}
                required
                autoFocus={!offering && !bank}
              />
            </Field>

            <MemberPicker members={members} defaultMember={defaultMember ?? null} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="헌금자 이름 (교인 미등록 시)"
                hint="위에서 교인을 고르지 않았을 때만 사용합니다."
              >
                <input
                  name="donorName"
                  className="field"
                  placeholder="예) 익명, 방문 성도"
                  defaultValue={offering?.donorName ?? bank?.donorName ?? ""}
                />
              </Field>
              <Field label="납부 방법">
                <select
                  name="method"
                  className="field"
                  defaultValue={offering?.method ?? (bank ? "TRANSFER" : "CASH")}
                >
                  {Object.entries(PAYMENT_METHODS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="메모">
              <textarea
                name="note"
                rows={2}
                className="field"
                defaultValue={offering?.note ?? ""}
              />
            </Field>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-2 pb-2">
          {showRepeat && !bank && (
            <label className="mr-auto flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" name="again" value="1" defaultChecked />
              저장 후 이어서 입력하기
            </label>
          )}
          <Link href={bank ? "/finance/bank" : "/finance/offerings"} className="btn btn-ghost">
            취소
          </Link>
          <SubmitButton>{submitLabel}</SubmitButton>
        </div>
      </form>

      {deleteAction && (
        <form action={deleteAction} className="flex justify-end">
          <ConfirmSubmitButton message="이 헌금 기록을 삭제할까요? 되돌릴 수 없습니다.">
            이 기록 삭제
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
