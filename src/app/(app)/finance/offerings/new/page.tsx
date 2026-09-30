import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth";
import { Alert, PageHeader } from "@/components/ui";
import { OfferingForm } from "../offering-form";
import { createOffering } from "../../actions";
import { pendingAlert, suggestFor } from "@/lib/bank";
import { ymdDash } from "@/lib/format";

export const metadata = { title: "헌금 입력" };

export default async function NewOfferingPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    ok?: string;
    date?: string;
    accountId?: string;
    bank?: string;
  }>;
}) {
  const staff = await requireFinance();
  const sp = await searchParams;

  const [accounts, members] = await Promise.all([
    prisma.account.findMany({
      where: { churchId: staff.churchId, type: "INCOME", active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.member.findMany({
      where: { churchId: staff.churchId, status: "ACTIVE" },
      select: { id: true, name: true, code: true, position: true, district: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // 입출금 알림함에서 "자세히 입력" 으로 넘어온 경우
  const alert = await pendingAlert(staff.churchId, sp.bank, "IN");
  const suggestion = alert ? await suggestFor(alert) : null;

  const pickable = members.map((m) => ({
    id: m.id,
    name: m.name,
    code: m.code,
    position: m.position,
    districtName: m.district?.name ?? null,
  }));

  return (
    <>
      <PageHeader
        title="헌금 입력"
        description="주일 헌금을 한 건씩 입력합니다. 교인을 연결해 두면 기부금영수증이 자동으로 계산됩니다."
        back={
          alert
            ? { href: "/finance/bank", label: "입출금 알림함" }
            : { href: "/finance/offerings", label: "헌금 내역" }
        }
      />

      {sp.error && (
        <div className="mb-5">
          <Alert tone="expense">
            날짜, 헌금 항목, 금액(1원 이상)을 모두 올바르게 입력해 주세요.
          </Alert>
        </div>
      )}
      {sp.ok && (
        <div className="mb-5">
          <Alert tone="income">저장되었습니다. 이어서 입력하실 수 있습니다.</Alert>
        </div>
      )}

      <OfferingForm
        action={createOffering}
        accounts={accounts}
        members={pickable}
        defaultDate={sp.date}
        defaultAccountId={sp.accountId ?? suggestion?.accountId ?? undefined}
        defaultMember={pickable.find((m) => m.id === suggestion?.memberId) ?? null}
        bank={
          alert
            ? {
                id: alert.id,
                date: ymdDash(alert.occurredAt),
                amount: alert.amount,
                donorName: suggestion?.memberId ? null : alert.counterparty,
              }
            : null
        }
        submitLabel="저장하기"
        showRepeat
      />
    </>
  );
}
