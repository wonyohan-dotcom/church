import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth";
import { Alert, PageHeader } from "@/components/ui";
import { GiverButton, GiverPickerProvider } from "@/components/giver-picker";
import { won } from "@/lib/format";
import { OfferingForm } from "../offering-form";
import { deleteOffering, updateOffering } from "../../actions";

export const metadata = { title: "헌금 수정" };

export default async function EditOfferingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const staff = await requireFinance();
  const { id } = await params;
  const sp = await searchParams;

  const [offering, accounts, members] = await Promise.all([
    prisma.offering.findUnique({
      where: { id },
      include: {
        member: { include: { district: true } },
        account: true,
        coGivers: { select: { member: { select: { id: true, name: true } } } },
      },
    }),
    prisma.account.findMany({
      where: { churchId: staff.churchId, type: "INCOME" },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.member.findMany({
      where: { churchId: staff.churchId },
      select: { id: true, name: true, code: true, position: true, district: true, status: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!offering || offering.churchId !== staff.churchId) notFound();

  const active = members.filter((m) => m.status === "ACTIVE");
  const pickable = active.map((m) => ({
    id: m.id,
    name: m.name,
    code: m.code,
    position: m.position,
    districtName: m.district?.name ?? null,
  }));

  const defaultMember = offering.member
    ? {
        id: offering.member.id,
        name: offering.member.name,
        code: offering.member.code,
        position: offering.member.position,
        districtName: offering.member.district?.name ?? null,
      }
    : null;

  return (
    <>
      <PageHeader
        title="헌금 수정"
        back={{ href: "/finance/offerings", label: "헌금 내역" }}
      />

      {sp.error && (
        <div className="mb-5">
          <Alert tone="expense">
            날짜, 헌금 항목, 금액(1원 이상)을 모두 올바르게 입력해 주세요.
          </Alert>
        </div>
      )}

      <GiverPickerProvider
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          sub: [m.position, m.district?.name, m.status !== "ACTIVE" ? "(비활동)" : null]
            .filter(Boolean)
            .join(" · "),
        }))}
      >
        <div className="card mb-5 flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink-3">헌금자</p>
            <p className="mt-0.5 font-semibold text-ink">
              {offering.member
                ? [offering.member.name, ...offering.coGivers.map((g) => g.member.name)].join(" · ")
                : (offering.donorName ?? "무명")}
            </p>
            {offering.coGivers.length > 0 && (
              <p className="mt-0.5 text-xs text-ink-3">
                함께 드린 헌금 · 기부금영수증은 {offering.member?.name} 님에게 들어갑니다.
              </p>
            )}
          </div>
          <GiverButton
            offeringId={offering.id}
            giverIds={[
              ...(offering.member ? [offering.member.id] : []),
              ...offering.coGivers.map((g) => g.member.id),
            ]}
            title={`${offering.account.name} · ${won(offering.amount)}`}
            writtenName={offering.donorName}
            className="btn btn-ghost btn-sm shrink-0"
          >
            여러 명 고르기
          </GiverButton>
        </div>
      </GiverPickerProvider>

      {/* 헌금자를 위에서 바꾸면 폼도 새 값으로 다시 그린다 */}
      <OfferingForm
        key={offering.memberId ?? "none"}
        action={updateOffering.bind(null, offering.id)}
        deleteAction={deleteOffering.bind(null, offering.id)}
        accounts={accounts}
        members={pickable}
        offering={offering}
        defaultMember={defaultMember}
        submitLabel="저장하기"
      />
    </>
  );
}
