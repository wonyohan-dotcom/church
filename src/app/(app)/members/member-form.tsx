import Link from "next/link";
import { Card, CardTitle, Field } from "@/components/ui";
import { PhotoInput, SubmitButton } from "@/components/form";
import {
  GENDERS,
  HOUSEHOLD_RELATIONS,
  MEMBER_STATUS,
  POSITIONS,
} from "@/lib/constants";
import { ymdDash } from "@/lib/format";
import type {
  DistrictModel as District,
  HouseholdModel as Household,
  MemberModel as Member,
} from "@/generated/prisma/models";

export function MemberForm({
  action,
  member,
  districts,
  households,
  cancelHref,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  member?: Member | null;
  districts: District[];
  households: Household[];
  cancelHref: string;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-5">
      {/* 기본 인적사항 */}
      <Card>
        <CardTitle>기본 정보</CardTitle>
        <div className="space-y-4">
          <PhotoInput
            name="photo"
            label="교인 사진"
            currentUrl={member?.photoUrl ?? null}
            shape="circle"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="이름" required>
              <input
                name="name"
                className="field"
                defaultValue={member?.name ?? ""}
                required
                autoFocus={!member}
              />
            </Field>
            <Field label="한자 이름">
              <input name="nameHanja" className="field" defaultValue={member?.nameHanja ?? ""} />
            </Field>
            <Field label="성별">
              <select name="gender" className="field" defaultValue={member?.gender ?? ""}>
                <option value="">선택 안 함</option>
                {Object.entries(GENDERS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="생년월일">
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  name="birthDate"
                  className="field"
                  defaultValue={ymdDash(member?.birthDate)}
                />
                <label className="flex shrink-0 items-center gap-1.5 text-sm text-ink-2">
                  <input
                    type="checkbox"
                    name="birthIsLunar"
                    value="1"
                    defaultChecked={member?.birthIsLunar ?? false}
                  />
                  음력
                </label>
              </div>
            </Field>
          </div>
        </div>
      </Card>

      {/* 연락처 */}
      <Card>
        <CardTitle>연락처</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="휴대전화">
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              className="field"
              placeholder="010-0000-0000"
              defaultValue={member?.phone ?? ""}
            />
          </Field>
          <Field label="이메일">
            <input
              name="email"
              type="email"
              className="field"
              autoCapitalize="none"
              defaultValue={member?.email ?? ""}
            />
          </Field>
          <Field label="우편번호">
            <input
              name="postalCode"
              inputMode="numeric"
              className="field"
              defaultValue={member?.postalCode ?? ""}
            />
          </Field>
          <Field label="주소" className="sm:col-span-2">
            <input name="address" className="field" defaultValue={member?.address ?? ""} />
          </Field>
          <Field label="상세 주소" className="sm:col-span-2">
            <input
              name="addressDetail"
              className="field"
              defaultValue={member?.addressDetail ?? ""}
            />
          </Field>
        </div>
      </Card>

      {/* 교회 소속 */}
      <Card>
        <CardTitle>교회 소속</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="직분">
            <select name="position" className="field" defaultValue={member?.position ?? ""}>
              <option value="">선택 안 함</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="교적 상태">
            <select name="status" className="field" defaultValue={member?.status ?? "ACTIVE"}>
              {Object.entries(MEMBER_STATUS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="교구·구역">
            <select name="districtId" className="field" defaultValue={member?.districtId ?? ""}>
              <option value="">소속 없음</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="소속 가정" hint="가정은 교적 &gt; 교구·가정 관리에서 추가할 수 있습니다.">
            <select name="householdId" className="field" defaultValue={member?.householdId ?? ""}>
              <option value="">소속 없음</option>
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="세대주와의 관계">
            <select
              name="householdRel"
              className="field"
              defaultValue={member?.householdRel ?? ""}
            >
              <option value="">선택 안 함</option>
              {HOUSEHOLD_RELATIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="직업">
            <input name="job" className="field" defaultValue={member?.job ?? ""} />
          </Field>
        </div>
      </Card>

      {/* 신앙 이력 */}
      <Card>
        <CardTitle>신앙 이력</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="교회 등록일">
            <input
              type="date"
              name="registeredAt"
              className="field"
              defaultValue={ymdDash(member?.registeredAt)}
            />
          </Field>
          <Field label="학습일">
            <input
              type="date"
              name="catechumenAt"
              className="field"
              defaultValue={ymdDash(member?.catechumenAt)}
            />
          </Field>
          <Field label="세례일">
            <input
              type="date"
              name="baptizedAt"
              className="field"
              defaultValue={ymdDash(member?.baptizedAt)}
            />
          </Field>
          <Field label="입교일">
            <input
              type="date"
              name="confirmedAt"
              className="field"
              defaultValue={ymdDash(member?.confirmedAt)}
            />
          </Field>
          <Field label="이전 출석 교회" className="sm:col-span-2">
            <input
              name="previousChurch"
              className="field"
              defaultValue={member?.previousChurch ?? ""}
            />
          </Field>
        </div>
      </Card>

      {/* 이명 · 소천 */}
      <Card>
        <CardTitle>이명 · 소천 기록</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="이명일">
            <input
              type="date"
              name="transferredAt"
              className="field"
              defaultValue={ymdDash(member?.transferredAt)}
            />
          </Field>
          <Field label="이명 교회">
            <input name="transferTo" className="field" defaultValue={member?.transferTo ?? ""} />
          </Field>
          <Field label="소천일">
            <input
              type="date"
              name="deceasedAt"
              className="field"
              defaultValue={ymdDash(member?.deceasedAt)}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="비고">
            <textarea name="note" className="field" rows={3} defaultValue={member?.note ?? ""} />
          </Field>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-2 pb-2">
        <Link href={cancelHref} className="btn btn-ghost">
          취소
        </Link>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
