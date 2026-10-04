import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff, canManageFinance, canPastoral } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { getYearSummary, monthRange } from "@/lib/finance";
import { findAbsentees, sundayTrend } from "@/lib/attendance";
import { findLinkable } from "@/lib/offering-givers";
import { ABSENCE_ALERT_WEEKS, HISTORY_CATEGORIES, NEWCOMER_DAYS, type HistoryCategory } from "@/lib/constants";
import { age, won, ymd } from "@/lib/format";
import { Alert, Avatar, Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import { CommunityShortcuts } from "@/components/community-shortcuts";
import { MonthlyIncomeExpenseChart } from "@/components/charts";
import {
  IconBank,
  IconBook,
  IconCake,
  IconCalendarCheck,
  IconCare,
  IconChevronRight,
  IconPlus,
  IconReceipt,
  IconUserPlus,
  IconUsers,
} from "@/components/icons";

export const metadata = { title: "홈" };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const finance = canManageFinance(staff.role);
  const pastoral = canPastoral(staff.role);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const newcomerSince = new Date(now.getTime() - NEWCOMER_DAYS * 24 * 3600 * 1000);

  const [
    church,
    memberCount,
    newcomers,
    birthdayPool,
    trend,
    absentees,
    pendingSignups,
    pendingReceipts,
    pendingBank,
    recentVisits,
    recentHistory,
  ] = await Promise.all([
    getChurch(staff.churchId),
    prisma.member.count({ where: { churchId: staff.churchId, status: "ACTIVE" } }),
    prisma.member.findMany({
      where: {
        churchId: staff.churchId,
        status: "ACTIVE",
        OR: [
          { registeredAt: { gte: newcomerSince } },
          { registeredAt: null, createdAt: { gte: newcomerSince } },
        ],
      },
      select: { id: true, name: true, photoUrl: true, position: true, registeredAt: true, createdAt: true },
      orderBy: [{ registeredAt: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.member.findMany({
      where: { churchId: staff.churchId, status: "ACTIVE", birthDate: { not: null } },
      select: { id: true, name: true, photoUrl: true, birthDate: true, position: true },
    }),
    sundayTrend(staff.churchId, 8),
    findAbsentees(staff.churchId),
    staff.role === "ADMIN"
      ? prisma.user.count({ where: { churchId: staff.churchId, status: "PENDING" } })
      : 0,
    finance
      ? prisma.donationReceipt.count({ where: { churchId: staff.churchId, status: "REQUESTED" } })
      : 0,
    finance
      ? prisma.bankAlert.count({ where: { churchId: staff.churchId, status: "PENDING" } })
      : 0,
    pastoral
      ? prisma.visit.findMany({
          where: { churchId: staff.churchId },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 4,
          include: { member: { select: { id: true, name: true, position: true } } },
        })
      : Promise.resolve([]),
    prisma.historyEvent.findMany({
      where: { churchId: staff.churchId },
      orderBy: { date: "desc" },
      take: 4,
    }),
  ]);

  // 재정 숫자는 회계 권한이 있는 사람에게만 계산해서 보여준다.
  const money = finance
    ? await Promise.all([
        getYearSummary(staff.churchId, year),
        prisma.offering.aggregate({
          where: { churchId: staff.churchId, date: monthRange(year, month) },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: { churchId: staff.churchId, date: monthRange(year, month) },
          _sum: { amount: true },
        }),
        prisma.offering.aggregate({ where: { churchId: staff.churchId }, _sum: { amount: true } }),
        prisma.expense.aggregate({ where: { churchId: staff.churchId }, _sum: { amount: true } }),
      ]).then(([summary, mIn, mOut, allIn, allOut]) => ({
        summary,
        monthIncome: mIn._sum.amount ?? 0,
        monthExpense: mOut._sum.amount ?? 0,
        balance: (allIn._sum.amount ?? 0) - (allOut._sum.amount ?? 0),
      }))
    : null;

  const birthdays = birthdayPool
    .filter((m) => m.birthDate!.getMonth() + 1 === month)
    .sort((a, b) => a.birthDate!.getDate() - b.birthDate!.getDate());
  // 오늘부터 7일 안의 생일
  const weekBirthdays = birthdays.filter((m) => {
    const d = m.birthDate!.getDate();
    return d >= now.getDate() && d < now.getDate() + 7;
  });

  // 이름으로 교인과 이을 수 있는 헌금 (회계 담당자에게만)
  const linkable = finance ? (await findLinkable(staff.churchId)).reduce((n, g) => n + g.offeringIds.length, 0) : 0;

  const todos = [
    pendingSignups > 0 && {
      href: "/settings",
      icon: <IconUsers width={18} height={18} />,
      text: "가입 신청을 확인하고 권한을 정해 주세요",
      count: `${pendingSignups}건`,
    },
    pendingBank > 0 && {
      href: "/finance/bank",
      icon: <IconBank width={18} height={18} />,
      text: "은행 입출금 알림을 장부에 기록해 주세요",
      count: `${pendingBank}건`,
    },
    linkable > 0 && {
      href: "/finance/offerings/link",
      icon: <IconUsers width={18} height={18} />,
      text: "이름으로 교인과 이을 수 있는 헌금이 있습니다",
      count: `${linkable}건`,
    },
    pendingReceipts > 0 && {
      href: "/receipts",
      icon: <IconReceipt width={18} height={18} />,
      text: "기부금영수증 발급 신청이 있습니다",
      count: `${pendingReceipts}건`,
    },
    absentees.length > 0 && {
      href: pastoral ? "/visits" : "/attendance",
      icon: <IconCare width={18} height={18} />,
      text: "오래 예배에 못 나오신 분을 돌아봐 주세요",
      count: `${absentees.length}명`,
    },
    weekBirthdays.length > 0 && {
      href: "#birthdays",
      icon: <IconCake width={18} height={18} />,
      text: `이번 주 생일 — ${weekBirthdays.map((m) => m.name).join(", ")}`,
      count: `${weekBirthdays.length}명`,
    },
  ].filter(Boolean) as { href: string; icon: React.ReactNode; text: string; count: string }[];

  const latest = trend.at(-1);
  const maxTrend = Math.max(1, ...trend.map((t) => t.total));

  return (
    <>
      <PageHeader
        eyebrow={`${month}월 ${now.getDate()}일 ${WEEKDAYS[now.getDay()]}요일`}
        title={`${staff.name}님, 평안하세요`}
        description={`${church.name} · 재적 ${memberCount}명${newcomers.length ? ` · 새가족 ${newcomers.length}명` : ""}`}
        actions={
          <>
            <Link href="/attendance/check" className="btn btn-ghost">
              <IconCalendarCheck width={17} height={17} />
              출석 체크
            </Link>
            {finance && (
              <Link href="/finance/offerings/new" className="btn btn-primary">
                <IconPlus width={16} height={16} />
                헌금 입력
              </Link>
            )}
          </>
        }
      />

      {sp.error === "forbidden" && (
        <div className="mb-5">
          <Alert tone="warn">해당 기능에 접근할 권한이 없습니다.</Alert>
        </div>
      )}

      {/* 챙길 일 — 오늘 손대야 하는 것만 모은다 */}
      <section className="mb-6">
        <p className="eyebrow mb-2 px-1">챙길 일</p>
        {todos.length === 0 ? (
          <div className="card px-5 py-4 text-sm text-ink-3">오늘은 따로 챙길 일이 없습니다.</div>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {todos.map((t) => (
              <li key={t.href + t.text}>
                <Link href={t.href} className="row-link">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    {t.icon}
                  </span>
                  <span className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-ink">{t.text}</span>
                  <span className="tnum shrink-0 text-sm font-bold text-primary">{t.count}</span>
                  <IconChevronRight width={16} height={16} className="shrink-0 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CommunityShortcuts churchId={staff.churchId} className="mb-6" />

      <div className={`mb-5 grid gap-5 ${money ? "lg:grid-cols-[1.55fr_1fr]" : ""}`}>
        {money && (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Link href="/finance/ledger" className="group">
                <p className="eyebrow">재정 · 현재 잔액</p>
                <p className="tnum mt-2 text-[2.2rem] font-bold leading-none tracking-[-0.03em] text-ink group-hover:text-primary sm:text-[2.6rem]">
                  {won(money.balance)}
                </p>
              </Link>
              <Link href="/finance/ledger" className="text-sm font-semibold text-primary">
                내역 보기 →
              </Link>
            </div>
            {/* 휴대폰에서는 한 줄씩, 넓은 화면에서는 세 칸으로 */}
            <div className="mt-5 divide-y divide-line border-y border-line sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                { label: `${month}월 수입`, value: money.monthIncome, tone: "text-income", href: `/finance/ledger?year=${year}&month=${month}&type=in` },
                { label: `${month}월 지출`, value: money.monthExpense, tone: "text-expense", href: `/finance/ledger?year=${year}&month=${month}&type=out` },
                {
                  label: `${year}년 수입−지출`,
                  value: money.summary.totalIncome - money.summary.totalExpense,
                  tone: "text-ink",
                  href: `/finance/ledger?year=${year}`,
                },
              ].map((x) => (
                <Link
                  key={x.label}
                  href={x.href}
                  className="flex items-center justify-between py-2.5 hover:bg-surface-2 sm:block sm:px-4 sm:py-3.5 sm:first:pl-0 sm:last:pr-0"
                >
                  <span className="text-sm text-ink-3 sm:block sm:text-xs">{x.label}</span>
                  <span className={`tnum flex items-center gap-1 text-[1.02rem] font-bold sm:mt-1 sm:text-lg ${x.tone}`}>
                    {won(x.value)}
                    <IconChevronRight width={14} height={14} className="text-ink-3 sm:hidden" />
                  </span>
                </Link>
              ))}
            </div>
            <div className="mt-4">
              <MonthlyIncomeExpenseChart data={money.summary.monthly} />
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">출석 · 최근 주일</p>
              {latest ? (
                <p className="mt-2 flex items-baseline gap-1.5">
                  <span className="tnum text-[2.2rem] font-bold leading-none tracking-[-0.03em] text-ink sm:text-[2.6rem]">
                    {latest.total}
                  </span>
                  <span className="text-ink-2">명</span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-3">아직 출석부가 없습니다.</p>
              )}
              {latest && (
                <p className="mt-1.5 text-xs text-ink-3">
                  {ymd(latest.date)} · 교인 {latest.members} · 방문 {latest.visitors}
                </p>
              )}
            </div>
            <Link href="/attendance" className="text-sm font-semibold text-primary">
              출석 →
            </Link>
          </div>
          {trend.length > 1 ? (
            <div className="mt-6 flex h-32 items-end gap-2" role="img" aria-label="최근 주일 출석 추이">
              {trend.map((t, i) => (
                <div key={t.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <div
                    className={`w-full max-w-8 rounded-t-md ${i === trend.length - 1 ? "bg-primary" : "bg-surface-3"}`}
                    style={{ height: `${Math.max(5, (t.total / maxTrend) * 100)}%` }}
                  />
                  <span className="tnum text-[0.64rem] text-ink-3">
                    {t.date.getMonth() + 1}/{t.date.getDate()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Link href="/attendance/check" className="btn btn-ghost mt-6 w-full">
              이번 주일 출석 체크하기
            </Link>
          )}
          {absentees.length > 0 && (
            <div className="mt-6 border-t border-line pt-4">
              <p className="text-sm font-semibold text-ink">
                {ABSENCE_ALERT_WEEKS}주 이상 못 나오신 분 <span className="tnum text-expense">{absentees.length}</span>
              </p>
              <ul className="mt-2 space-y-1.5">
                {absentees.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/members/${a.id}${pastoral ? "#visits" : ""}`} className="truncate text-ink-2 hover:text-ink">
                      {a.name} <span className="text-ink-3">{a.position}</span>
                    </Link>
                    <span className="tnum shrink-0 text-xs text-ink-3">
                      {a.lastSeen ? `마지막 ${a.lastSeen.getMonth() + 1}/${a.lastSeen.getDate()}` : "기록 없음"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardTitle
              action={
                <Link href="/members/new" className="text-sm font-semibold text-primary">
                  등록
                </Link>
              }
            >
              새가족 <span className="font-medium text-ink-3">최근 {NEWCOMER_DAYS}일</span>
            </CardTitle>
          </div>
          {newcomers.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-ink-3">최근 등록한 새가족이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {newcomers.map((m) => (
                <li key={m.id}>
                  <Link href={`/members/${m.id}`} className="row-link py-3">
                    <Avatar src={m.photoUrl} name={m.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{m.name}</span>
                      <span className="block text-xs text-ink-3">{m.position ?? "성도"}</span>
                    </span>
                    <span className="tnum text-xs text-ink-3">{ymd(m.registeredAt ?? m.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padded={false}>
          <div id="birthdays" className="scroll-mt-24 px-5 pt-5">
            <CardTitle>{month}월 생일</CardTitle>
          </div>
          {birthdays.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-ink-3">이번 달 생일이신 분이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {birthdays.slice(0, 6).map((m) => (
                <li key={m.id}>
                  <Link href={`/members/${m.id}`} className="row-link py-3">
                    <Avatar src={m.photoUrl} name={m.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{m.name}</span>
                      <span className="block text-xs text-ink-3">
                        {m.position ?? "성도"}
                        {age(m.birthDate) !== null && ` · 만 ${age(m.birthDate)}세`}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-sm font-semibold text-accent">
                      {m.birthDate!.getMonth() + 1}.{m.birthDate!.getDate()}
                    </span>
                  </Link>
                </li>
              ))}
              {birthdays.length > 6 && (
                <li className="px-5 py-3 text-xs text-ink-3">외 {birthdays.length - 6}명</li>
              )}
            </ul>
          )}
        </Card>

        {pastoral ? (
          <Card padded={false}>
            <div className="px-5 pt-5">
              <CardTitle
                action={
                  <Link href="/visits" className="text-sm font-semibold text-primary">
                    전체
                  </Link>
                }
              >
                최근 심방·상담
              </CardTitle>
            </div>
            {recentVisits.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-ink-3">아직 기록이 없습니다.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {recentVisits.map((v) => (
                  <li key={v.id}>
                    <Link href={`/members/${v.member.id}#visits`} className="block px-5 py-3 hover:bg-surface-2">
                      <span className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-semibold text-ink">
                          {v.member.name} <span className="font-normal text-ink-3">{v.member.position}</span>
                        </span>
                        <span className="tnum text-xs text-ink-3">{ymd(v.date)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-2">{v.content}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <HistoryCard events={recentHistory} />
        )}
      </div>

      {pastoral && (
        <div className="mt-5">
          <HistoryCard events={recentHistory} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickLink href="/members/new" icon={<IconUserPlus />} label="교인 등록" />
        <QuickLink href="/attendance/check" icon={<IconCalendarCheck />} label="출석 체크" />
        {finance ? (
          <>
            <QuickLink href="/finance/expenses/new" icon={<IconReceipt />} label="지출 입력" />
            <QuickLink href="/finance/report" icon={<IconBank />} label="결산서" />
          </>
        ) : (
          <>
            <QuickLink href="/history/new" icon={<IconBook />} label="연혁 기록" />
            <QuickLink href="/members" icon={<IconUsers />} label="교적 보기" />
          </>
        )}
      </div>
    </>
  );
}

function HistoryCard({
  events,
}: {
  events: { id: string; title: string; date: Date; category: string }[];
}) {
  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <CardTitle
          action={
            <Link href="/history" className="text-sm font-semibold text-primary">
              전체
            </Link>
          }
        >
          교회 역사
        </CardTitle>
      </div>
      {events.length === 0 ? (
        <div className="px-5 pb-6">
          <p className="text-sm text-ink-3">아직 기록된 연혁이 없습니다.</p>
          <Link href="/history/new" className="btn btn-ghost btn-sm mt-3">
            연혁 등록하기
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {events.map((h) => (
            <li key={h.id}>
              <Link href={`/history/${h.id}`} className="row-link py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{h.title}</span>
                  <span className="tnum block text-xs text-ink-3">{ymd(h.date)}</span>
                </span>
                <Badge>{HISTORY_CATEGORIES[h.category as HistoryCategory] ?? h.category}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="card flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
      <span className="text-primary">{icon}</span>
      <span className="text-sm font-semibold text-ink">{label}</span>
    </Link>
  );
}
