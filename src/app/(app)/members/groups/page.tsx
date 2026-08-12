import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { phone as fmtPhone } from "@/lib/format";
import { Card, CardTitle, EmptyState, Field, PageHeader } from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form";
import { AddressFields } from "@/components/address-fields";
import { IconUsers } from "@/components/icons";
import {
  createDistrict,
  createHousehold,
  deleteDistrict,
  deleteHousehold,
} from "../actions";

export const metadata = { title: "교구·가정 관리" };

export default async function GroupsPage() {
  const staff = await requireStaff();

  const [districts, households] = await Promise.all([
    prisma.district.findMany({
      where: { churchId: staff.churchId },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { members: true } } },
    }),
    prisma.household.findMany({
      where: { churchId: staff.churchId },
      orderBy: { name: "asc" },
      include: { district: true, _count: { select: { members: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="교구 · 가정 관리"
        description="교구(구역)와 가정을 만들어 두면 교인 등록 시 바로 선택할 수 있습니다."
        back={{ href: "/members", label: "교적 관리" }}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 교구 */}
        <div className="space-y-5">
          <Card>
            <CardTitle>교구 · 구역 추가</CardTitle>
            <form action={createDistrict} className="space-y-3">
              <Field label="교구 이름" required>
                <input name="name" className="field" placeholder="예) 1교구" required />
              </Field>
              <Field label="구역장 / 담당">
                <input name="leaderName" className="field" placeholder="예) 김권사" />
              </Field>
              <SubmitButton className="btn btn-primary w-full">추가하기</SubmitButton>
            </form>
          </Card>

          <Card padded={false}>
            <div className="p-5 pb-3">
              <CardTitle>교구 목록 ({districts.length})</CardTitle>
            </div>
            {districts.length === 0 ? (
              <EmptyState icon={<IconUsers />} title="등록된 교구가 없습니다" />
            ) : (
              <ul className="divide-y divide-line">
                {districts.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{d.name}</p>
                      <p className="text-xs text-ink-3">
                        {d.leaderName ? `${d.leaderName} · ` : ""}
                        {d._count.members}명
                      </p>
                    </div>
                    <Link
                      href={`/members?district=${d.id}&status=ALL`}
                      className="btn btn-quiet btn-sm"
                    >
                      명단
                    </Link>
                    <form action={deleteDistrict.bind(null, d.id)}>
                      <ConfirmSubmitButton
                        className="btn btn-danger btn-sm"
                        message={`'${d.name}' 교구를 삭제할까요? 소속 교인의 교구 정보만 비워집니다.`}
                      >
                        삭제
                      </ConfirmSubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* 가정 */}
        <div className="space-y-5">
          <Card>
            <CardTitle>가정 추가</CardTitle>
            <form action={createHousehold} className="space-y-3">
              <Field label="가정 이름" required hint="예) 홍길동 집사 가정">
                <input name="name" className="field" placeholder="예) 홍길동 집사 가정" required />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="교구">
                  <select name="districtId" className="field">
                    <option value="">선택 안 함</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="대표 연락처">
                  <input name="phone" type="tel" className="field" placeholder="010-0000-0000" />
                </Field>
              </div>
              <AddressFields label="가정 주소" />
              <SubmitButton className="btn btn-primary w-full">추가하기</SubmitButton>
            </form>
          </Card>

          <Card padded={false}>
            <div className="p-5 pb-3">
              <CardTitle>가정 목록 ({households.length})</CardTitle>
            </div>
            {households.length === 0 ? (
              <EmptyState icon={<IconUsers />} title="등록된 가정이 없습니다" />
            ) : (
              <ul className="divide-y divide-line">
                {households.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{h.name}</p>
                      <p className="truncate text-xs text-ink-3">
                        {[h.district?.name, h.address, fmtPhone(h.phone)]
                          .filter((v) => v && v !== "-")
                          .join(" · ") || "정보 없음"}
                        {` · ${h._count.members}명`}
                      </p>
                    </div>
                    <form action={deleteHousehold.bind(null, h.id)}>
                      <ConfirmSubmitButton
                        className="btn btn-danger btn-sm"
                        message={`'${h.name}'을(를) 삭제할까요? 소속 교인의 가정 정보만 비워집니다.`}
                      >
                        삭제
                      </ConfirmSubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
