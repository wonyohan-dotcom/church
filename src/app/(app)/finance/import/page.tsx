import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { FinanceImporter } from "./finance-importer";

export const metadata = { title: "엑셀로 수입·지출 입력" };

export default async function FinanceImportPage() {
  const staff = await requireFinance();
  const [accounts, members] = await Promise.all([
    prisma.account.findMany({
      where: { churchId: staff.churchId },
      select: { name: true, type: true },
    }),
    prisma.member.findMany({ where: { churchId: staff.churchId }, select: { name: true } }),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="재정"
        title="엑셀로 수입·지출 입력"
        description="재정 장부 엑셀을 올리면 헌금과 지출을 알아보고, 확인한 뒤 한 번에 입력합니다."
        back={{ href: "/finance", label: "회계 관리" }}
      />
      <FinanceImporter
        accounts={accounts.map((a) => ({ name: a.name, type: a.type === "EXPENSE" ? "EXPENSE" : "INCOME" }))}
        memberNames={members.map((m) => m.name)}
      />
    </>
  );
}
