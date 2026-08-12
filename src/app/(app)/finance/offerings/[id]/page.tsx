import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth";
import { Alert, PageHeader } from "@/components/ui";
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
      include: { member: { include: { district: true } } },
    }),
    prisma.account.findMany({
      where: { churchId: staff.churchId, type: "INCOME" },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.member.findMany({
      where: { churchId: staff.churchId, status: "ACTIVE" },
      select: { id: true, name: true, code: true, position: true, district: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!offering || offering.churchId !== staff.churchId) notFound();

  const pickable = members.map((m) => ({
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

      <OfferingForm
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
