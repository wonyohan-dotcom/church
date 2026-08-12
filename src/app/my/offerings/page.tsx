import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMemberYearOfferings } from "@/lib/finance";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { won, ymd } from "@/lib/format";
import { Alert, Card, CardTitle, PageHeader, StatCard, TableWrap } from "@/components/ui";
import { BreakdownBars } from "@/components/charts";
import { YearSelect } from "@/components/year-select";

export const metadata = { title: "내 헌금 내역" };

export default async function MyOfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  if (!user.memberId) {
    return (
      <>
        <PageHeader title="헌금 내역" />
        <Alert tone="warn">교적 정보가 연결되어 있지 않습니다. 교회 사무실에 문의해 주세요.</Alert>
      </>
    );
  }

  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  const [data, member] = await Promise.all([
    getMemberYearOfferings(user.memberId, year),
    prisma.member.findFirst({
      where: { id: user.memberId, churchId: user.churchId },
      select: { name: true },
    }),
  ]);

  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0 }));
  for (const o of data.offerings) monthly[o.date.getMonth()].amount += o.amount;

  return (
    <>
      <PageHeader
        title="헌금 내역"
        description={`${member?.name ?? user.name}님의 ${year}년 헌금 기록입니다.`}
        actions={<YearSelect year={year} years={years} basePath="/my/offerings" />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatCard label={`${year}년 합계`} value={won(data.total)} tone="income" />
        <StatCard
          label="공제 대상"
          value={won(data.deductibleTotal)}
          sub={`${data.offerings.length}회`}
        />
      </div>

      {data.offerings.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-ink-3">
            {year}년에 기록된 헌금 내역이 없습니다.
          </p>
        </Card>
      ) : (
        <>
          <Card className="mb-5">
            <CardTitle>항목별 합계</CardTitle>
            <BreakdownBars
              items={data.items.map((i) => ({ name: i.accountName, amount: i.amount }))}
            />
          </Card>

          <Card className="mb-5">
            <CardTitle>월별 합계</CardTitle>
            <BreakdownBars
              items={monthly
                .filter((m) => m.amount > 0)
                .map((m) => ({ name: `${m.month}월`, amount: m.amount }))}
            />
          </Card>

          <h2 className="mb-2.5 px-1 text-[0.95rem] font-bold text-ink">상세 내역</h2>
          <TableWrap>
            <table className="table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>항목</th>
                  <th>방법</th>
                  <th className="text-right">금액</th>
                </tr>
              </thead>
              <tbody>
                {[...data.offerings].reverse().map((o) => (
                  <tr key={o.id}>
                    <td className="tnum whitespace-nowrap text-ink-2">{ymd(o.date)}</td>
                    <td className="font-medium text-ink">{o.account.name}</td>
                    <td className="text-ink-3">
                      {PAYMENT_METHODS[o.method as PaymentMethod] ?? o.method}
                    </td>
                    <td className="tnum whitespace-nowrap text-right font-semibold text-ink">
                      {won(o.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-ink-3">
        내역이 실제와 다르다면 교회 사무실로 알려 주세요.
      </p>
    </>
  );
}
