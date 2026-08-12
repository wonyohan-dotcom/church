import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff, canManageFinance } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { getYearSummary, monthRange } from "@/lib/finance";
import { HISTORY_CATEGORIES, type HistoryCategory } from "@/lib/constants";
import { age, won, ymd } from "@/lib/format";
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardTitle,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { MonthlyIncomeExpenseChart } from "@/components/charts";
import { IconPlus, IconReceipt, IconUsers, IconWallet } from "@/components/icons";

export const metadata = { title: "대시보드" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [church, summary, memberCount, monthIncome, monthExpense, pendingReceipts, recentHistory] =
    await Promise.all([
      getChurch(),
      getYearSummary(year),
      prisma.member.count({ where: { status: "ACTIVE" } }),
      prisma.offering.aggregate({
        where: { date: monthRange(year, month) },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { date: monthRange(year, month) },
        _sum: { amount: true },
      }),
      prisma.donationReceipt.count({ where: { status: "REQUESTED" } }),
      prisma.historyEvent.findMany({ orderBy: { date: "desc" }, take: 4 }),
    ]);

  // 이번 달 생일자 — 저장된 생년월일에서 월만 비교한다.
  const activeMembers = await prisma.member.findMany({
    where: { status: "ACTIVE", birthDate: { not: null } },
    select: { id: true, name: true, photoUrl: true, birthDate: true, position: true },
  });
  const birthdays = activeMembers
    .filter((m) => m.birthDate && m.birthDate.getMonth() + 1 === month)
    .sort((a, b) => (a.birthDate!.getDate() ?? 0) - (b.birthDate!.getDate() ?? 0));

  const canEdit = canManageFinance(staff.role);
  const monthBalance = (monthIncome._sum.amount ?? 0) - (monthExpense._sum.amount ?? 0);

  return (
    <>
      <PageHeader
        title={`${staff.name}님, 안녕하세요`}
        description={`${church.name} · ${year}년 ${month}월`}
        actions={
          canEdit && (
            <Link href="/finance/offerings/new" className="btn btn-primary">
              <IconPlus width={16} height={16} />
              헌금 입력
            </Link>
          )
        }
      />

      {sp.error === "forbidden" && (
        <div className="mb-5">
          <Alert tone="warn">해당 기능에 접근할 권한이 없습니다.</Alert>
        </div>
      )}

      {pendingReceipts > 0 && (
        <div className="mb-5">
          <Alert tone="warn">
            발급을 기다리는 기부금영수증 신청이 {pendingReceipts}건 있습니다.{" "}
            <Link href="/receipts" className="font-bold underline">
              처리하러 가기
            </Link>
          </Alert>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="재적 교인"
          value={`${memberCount}명`}
          tone="primary"
          icon={<IconUsers width={18} height={18} />}
        />
        <StatCard
          label={`${month}월 헌금`}
          value={won(monthIncome._sum.amount ?? 0)}
          tone="income"
          icon={<IconWallet width={18} height={18} />}
        />
        <StatCard
          label={`${month}월 지출`}
          value={won(monthExpense._sum.amount ?? 0)}
          tone="expense"
        />
        <StatCard
          label={`${month}월 잔액`}
          value={won(monthBalance)}
          tone={monthBalance >= 0 ? "default" : "expense"}
        />
      </div>

      <div className="mb-5">
        <Card>
          <CardTitle
            action={
              <Link
                href="/finance"
                className="text-sm font-semibold text-primary hover:underline"
              >
                회계 관리
              </Link>
            }
          >
            {year}년 월별 수입 · 지출
          </CardTitle>
          <MonthlyIncomeExpenseChart data={summary.monthly} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 이번 달 생일 */}
        <Card padded={false}>
          <div className="p-5 pb-3">
            <CardTitle>{month}월 생일 교인</CardTitle>
          </div>
          {birthdays.length === 0 ? (
            <p className="px-5 pb-6 text-center text-sm text-ink-3">
              이번 달 생일이신 교인이 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {birthdays.slice(0, 8).map((m) => (
                <li key={m.id}>
                  <Link href={`/members/${m.id}`} className="flex items-center gap-3 px-5 py-3">
                    <Avatar src={m.photoUrl} name={m.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{m.name}</span>
                      <span className="block text-xs text-ink-3">
                        {m.position ?? "성도"}
                        {age(m.birthDate) !== null && ` · 만 ${age(m.birthDate)}세`}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-sm font-semibold text-accent">
                      {m.birthDate!.getMonth() + 1}. {m.birthDate!.getDate()}.
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {birthdays.length > 8 && (
            <p className="px-5 pb-4 text-center text-xs text-ink-3">
              외 {birthdays.length - 8}명
            </p>
          )}
        </Card>

        {/* 최근 연혁 */}
        <Card padded={false}>
          <div className="p-5 pb-3">
            <CardTitle
              action={
                <Link
                  href="/history"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  전체 보기
                </Link>
              }
            >
              최근 교회 역사
            </CardTitle>
          </div>
          {recentHistory.length === 0 ? (
            <div className="px-5 pb-6 text-center">
              <p className="text-sm text-ink-3">아직 기록된 연혁이 없습니다.</p>
              <Link href="/history/new" className="btn btn-ghost btn-sm mt-3">
                연혁 등록하기
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recentHistory.map((h) => (
                <li key={h.id}>
                  <Link href={`/history/${h.id}`} className="flex items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {h.title}
                      </span>
                      <span className="tnum block text-xs text-ink-3">{ymd(h.date)}</span>
                    </span>
                    <Badge>
                      {HISTORY_CATEGORIES[h.category as HistoryCategory] ?? h.category}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* 빠른 이동 */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickLink href="/members/new" icon={<IconUsers />} label="교인 등록" />
        <QuickLink href="/finance/expenses/new" icon={<IconWallet />} label="지출 입력" />
        <QuickLink href="/receipts" icon={<IconReceipt />} label="영수증 발급" />
        <QuickLink href="/finance/report" icon={<IconWallet />} label="결산서" />
      </div>
    </>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="card flex flex-col items-center gap-2 p-4 text-center transition-colors hover:bg-surface-2"
    >
      <span className="text-ink-3">{icon}</span>
      <span className="text-sm font-semibold text-ink">{label}</span>
    </Link>
  );
}
