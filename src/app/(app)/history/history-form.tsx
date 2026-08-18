import Link from "next/link";
import { Card, CardTitle, Field } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { HISTORY_CATEGORIES } from "@/lib/constants";
import { ymdDash } from "@/lib/format";
import type { HistoryEventModel } from "@/generated/prisma/models";

export function HistoryForm({
  action,
  event,
  cancelHref,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  event?: HistoryEventModel | null;
  cancelHref: string;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-5">
      <Card>
        <CardTitle>연혁 내용</CardTitle>
        <div className="space-y-4">
          <Field label="제목" required>
            <input
              name="title"
              className="field"
              required
              autoFocus={!event}
              placeholder="예) 교회 창립 예배, 새 성전 입당"
              defaultValue={event?.title ?? ""}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="날짜" required>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  name="date"
                  className="field"
                  required
                  defaultValue={ymdDash(event?.date)}
                />
                <label className="flex shrink-0 items-center gap-1.5 text-sm text-ink-2">
                  <input
                    type="checkbox"
                    name="dateIsApprox"
                    value="1"
                    defaultChecked={event?.dateIsApprox ?? false}
                  />
                  추정
                </label>
              </div>
            </Field>

            <Field label="분류" required>
              <select
                name="category"
                className="field"
                defaultValue={event?.category ?? "GENERAL"}
              >
                {Object.entries(HISTORY_CATEGORIES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="내용" hint="당시 상황, 참여한 분들, 배경 등을 자유롭게 기록하세요.">
            <textarea
              name="content"
              className="field"
              rows={7}
              defaultValue={event?.content ?? ""}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              name="pinned"
              value="1"
              defaultChecked={event?.pinned ?? false}
            />
            교회의 주요 연혁으로 표시하기
          </label>
        </div>
      </Card>

      {!event && (
        <p className="text-xs text-ink-3">
          사진은 등록한 뒤, 상세 화면에서 추가할 수 있습니다.
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pb-2">
        <Link href={cancelHref} className="btn btn-ghost">
          취소
        </Link>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
