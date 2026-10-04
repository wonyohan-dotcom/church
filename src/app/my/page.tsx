import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getCurrentBalance, getMemberYearOfferings } from "@/lib/finance";
import { getChurch } from "@/lib/church";
import { RECEIPT_STATUS, type ReceiptStatus } from "@/lib/constants";
import { won, ymd } from "@/lib/format";
import { Alert, Avatar, Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import { IconChevronRight, IconReceipt } from "@/components/icons";
import { PushToggle } from "@/components/push-toggle";

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

  const church = await getChurch(user.churchId);
  const balance = church.showBalanceToMembers ? (await getCurrentBalance(user.churchId)).balance : null;

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

  const monthly = Array.from({ length: 12 }, () => 0);
  for (const o of thisYearData.offerings) monthly[o.date.getMonth()] += o.amount;
  const maxMonth = Math.max(1, ...monthly);

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

      {/* 올해 내가 드린 헌금 — 성도 화면에서 가장 크게 보여 준다 */}
      <section className="mb-5 overflow-hidden rounded-2xl bg-primary p-5 text-primary-ink shadow-[var(--shadow-sm)] sm:p-6">
        <p className="text-sm font-semibold opacity-80">{thisYear}년 내가 드린 헌금</p>
        <p className="tnum mt-1 text-[2.1rem] font-bold leading-tight tracking-[-0.02em] sm:text-[2.5rem]">
          {won(thisYearData.total)}
        </p>
        <p className="tnum mt-1 text-sm opacity-80">
          {thisYearData.offerings.length}회
          {lastYearData.total > 0 && ` · ${lastYear}년 전체 ${won(lastYearData.total)}`}
        </p>

        {/* 달별 막대 */}
        <div className="mt-5 flex h-20 items-end gap-1.5" aria-label="달별 헌금">
          {monthly.map((amount, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t-md bg-[var(--primary-ink)] ${amount ? "opacity-80" : "opacity-15"}`}
                style={{ height: `${Math.max(4, (amount / maxMonth) * 64)}px` }}
                title={`${i + 1}월 ${won(amount)}`}
              />
              <span className="tnum text-[0.62rem] opacity-70">{i + 1}</span>
            </div>
          ))}
        </div>

        {thisYearData.items.length > 0 && (
          <ul className="mt-5 space-y-1.5 border-t border-[color-mix(in_srgb,var(--primary-ink)_20%,transparent)] pt-4 text-sm">
            {thisYearData.items.slice(0, 4).map((it) => (
              <li key={it.accountName} className="flex justify-between gap-3">
                <span className="opacity-85">{it.accountName} <span className="opacity-60">{it.count}회</span></span>
                <span className="tnum font-semibold">{won(it.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/my/offerings" className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">
          내 헌금 전체 보기 →
        </Link>
      </section>

      {balance !== null && (
        <div className="mb-5 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
          <span className="text-sm text-ink-2">우리 교회 현재 잔액</span>
          <span className="tnum text-[0.95rem] font-bold text-ink">{won(balance)}</span>
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

      <Card className="mt-5">
        <CardTitle>알림 받기</CardTitle>
        <p className="mb-4 text-sm leading-relaxed text-ink-3">
          켜 두면 기부금영수증이 발급되었을 때 바로 알려 드립니다.
        </p>
        <PushToggle />
      </Card>

      <p className="mt-6 text-center text-xs leading-relaxed text-ink-3">
        헌금 내역이 실제와 다르다면 교회 사무실로 알려 주세요.
      </p>
    </>
  );
}
