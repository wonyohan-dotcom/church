import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMemberYearOfferings } from "@/lib/finance";
import { RECEIPT_STATUS, type ReceiptStatus } from "@/lib/constants";
import { won, ymd } from "@/lib/format";
import { Alert, Avatar, Badge, Card, CardTitle, PageHeader, StatCard } from "@/components/ui";
import { IconChevronRight, IconReceipt } from "@/components/icons";

export const metadata = { title: "성도 서비스" };

export default async function MyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  if (!user.memberId) {
    return (
      <>
        <PageHeader title={`${user.name}님, 환영합니다`} />
        <Alert tone="warn">
          이 계정에 교적 정보가 연결되어 있지 않습니다. 교회 사무실에 문의해 주세요.
        </Alert>
      </>
    );
  }

  const thisYear = new Date().getFullYear();
  const lastYear = thisYear - 1;

  const [member, thisYearData, lastYearData, receipts] = await Promise.all([
    prisma.member.findFirst({
      where: { id: user.memberId, churchId: user.churchId },
      include: { district: true },
    }),
    getMemberYearOfferings(user.memberId, thisYear),
    getMemberYearOfferings(user.memberId, lastYear),
    prisma.donationReceipt.findMany({
      where: {
        churchId: user.churchId,
        memberId: user.memberId,
        status: { not: "CANCELED" },
      },
      orderBy: { year: "desc" },
      take: 3,
    }),
  ]);

  if (!member) {
    return (
      <>
        <PageHeader title={`${user.name}님, 환영합니다`} />
        <Alert tone="warn">교적 정보를 찾을 수 없습니다. 교회 사무실에 문의해 주세요.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader title={`${member.name}님, 반갑습니다`} />

      {sp.error === "no-member" && (
        <div className="mb-5">
          <Alert tone="warn">교적 정보가 연결되어 있지 않습니다.</Alert>
        </div>
      )}

      <Card className="mb-5">
        <div className="flex items-center gap-4">
          <Avatar src={member.photoUrl} name={member.name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{member.name}</p>
            <p className="tnum text-sm text-ink-3">
              교적번호 {member.code}
              {member.position && ` · ${member.position}`}
              {member.district && ` · ${member.district.name}`}
            </p>
          </div>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatCard
          label={`${thisYear}년 헌금 누계`}
          value={won(thisYearData.total)}
          sub={`${thisYearData.offerings.length}회`}
          tone="income"
        />
        <StatCard
          label={`${lastYear}년 헌금 누계`}
          value={won(lastYearData.total)}
          sub={`${lastYearData.offerings.length}회`}
        />
      </div>

      <Card className="mb-5">
        <CardTitle
          action={
            <Link
              href="/my/receipts"
              className="text-sm font-semibold text-primary hover:underline"
            >
              신청하기
            </Link>
          }
        >
          기부금영수증
        </CardTitle>

        {receipts.length === 0 ? (
          <div className="rounded-xl bg-surface-2 px-4 py-5 text-center">
            <p className="text-sm text-ink-2">
              연말정산용 기부금영수증을 온라인으로 바로 신청하실 수 있습니다.
            </p>
            <Link href="/my/receipts" className="btn btn-primary btn-sm mt-3">
              <IconReceipt width={16} height={16} />
              영수증 신청하기
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {receipts.map((r) => (
              <li key={r.id}>
                <Link href={`/my/receipts/${r.id}`} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="tnum block text-sm font-semibold text-ink">
                      {r.year}년 귀속
                    </span>
                    <span className="tnum block text-xs text-ink-3">
                      {won(r.totalAmount)}
                      {r.issuedAt && ` · 발급 ${ymd(r.issuedAt)}`}
                    </span>
                  </span>
                  <Badge tone={r.status === "ISSUED" ? "income" : "warn"}>
                    {RECEIPT_STATUS[r.status as ReceiptStatus] ?? r.status}
                  </Badge>
                  <IconChevronRight width={16} height={16} className="shrink-0 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-3">
          <CardTitle
            action={
              <Link
                href="/my/offerings"
                className="text-sm font-semibold text-primary hover:underline"
              >
                전체 보기
              </Link>
            }
          >
            최근 헌금
          </CardTitle>
        </div>
        {thisYearData.offerings.length === 0 ? (
          <p className="px-5 pb-6 text-center text-sm text-ink-3">
            올해 기록된 헌금 내역이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {[...thisYearData.offerings]
              .reverse()
              .slice(0, 5)
              .map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {o.account.name}
                    </span>
                    <span className="tnum block text-xs text-ink-3">{ymd(o.date)}</span>
                  </span>
                  <span className="tnum shrink-0 text-sm font-semibold text-ink">
                    {won(o.amount)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <p className="mt-6 text-center text-xs leading-relaxed text-ink-3">
        헌금 내역이 실제와 다르다면 교회 사무실로 알려 주세요.
      </p>
    </>
  );
}
