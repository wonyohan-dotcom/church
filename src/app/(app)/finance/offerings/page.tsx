import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff, canManageFinance } from "@/lib/auth";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { won, ymd } from "@/lib/format";
import { Alert, Card, EmptyState, PageHeader, StatCard, TableWrap } from "@/components/ui";
import { IconPlus, IconWallet } from "@/components/icons";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "헌금 내역" };

const PAGE_SIZE = 50;

const MESSAGES: Record<string, string> = {
  created: "헌금이 입력되었습니다.",
  updated: "헌금 내역이 수정되었습니다.",
  deleted: "헌금 내역이 삭제되었습니다.",
};

export default async function OfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    account?: string;
    member?: string;
    page?: string;
    ok?: string;
  }>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;

  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = sp.month ? Number(sp.month) : 0; // 0 = 전체
  const accountId = sp.account ?? "";
  const memberId = sp.member ?? "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const dateFilter =
    month > 0
      ? { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) }
      : { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) };

  const where: Prisma.OfferingWhereInput = {
    date: dateFilter,
    ...(accountId ? { accountId } : {}),
    ...(memberId ? { memberId } : {}),
  };

  const [offerings, total, sum, accounts, member] = await Promise.all([
    prisma.offering.findMany({
      where,
      include: { account: true, member: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.offering.count({ where }),
    prisma.offering.aggregate({ where, _sum: { amount: true } }),
    prisma.account.findMany({
      where: { type: "INCOME" },
      orderBy: { sortOrder: "asc" },
    }),
    memberId ? prisma.member.findUnique({ where: { id: memberId } }) : null,
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canEdit = canManageFinance(staff.role);
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  function hrefWith(patch: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    const merged = { year, month, account: accountId, member: memberId, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "" && v !== 0) params.set(k, String(v));
    }
    const s = params.toString();
    return `/finance/offerings${s ? `?${s}` : ""}`;
  }

  return (
    <>
      <PageHeader
        title="헌금 내역"
        description={
          member
            ? `${member.name} 교인의 헌금 내역입니다.`
            : "기간과 항목별로 헌금 기록을 조회합니다."
        }
        back={{ href: "/finance", label: "회계 관리" }}
        actions={
          canEdit && (
            <Link href="/finance/offerings/new" className="btn btn-primary">
              <IconPlus width={16} height={16} />
              헌금 입력
            </Link>
          )
        }
      />

      {sp.ok && MESSAGES[sp.ok] && (
        <div className="mb-5">
          <Alert tone="income">{MESSAGES[sp.ok]}</Alert>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatCard label="조회 건수" value={`${total.toLocaleString("ko-KR")}건`} />
        <StatCard label="합계 금액" value={won(sum._sum.amount ?? 0)} tone="income" />
      </div>

      {/* 조회 조건 */}
      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        {memberId && <input type="hidden" name="member" value={memberId} />}
        <div className="w-[7.5rem]">
          <label className="label" htmlFor="year">
            연도
          </label>
          <select id="year" name="year" defaultValue={String(year)} className="field">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
        <div className="w-[7rem]">
          <label className="label" htmlFor="month">
            월
          </label>
          <select id="month" name="month" defaultValue={String(month)} className="field">
            <option value="0">전체</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[9rem] flex-1">
          <label className="label" htmlFor="account">
            헌금 항목
          </label>
          <select id="account" name="account" defaultValue={accountId} className="field">
            <option value="">전체</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          조회
        </button>
        {memberId && (
          <Link href="/finance/offerings" className="btn btn-quiet">
            교인 필터 해제
          </Link>
        )}
      </form>

      {offerings.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconWallet />}
            title="해당 기간에 헌금 기록이 없습니다"
            description="조회 조건을 바꾸시거나 새 헌금을 입력해 주세요."
            action={
              canEdit && (
                <Link href="/finance/offerings/new" className="btn btn-primary">
                  <IconPlus width={16} height={16} />
                  헌금 입력
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="hidden sm:block">
            <TableWrap>
              <table className="table">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>항목</th>
                    <th>헌금자</th>
                    <th>방법</th>
                    <th className="text-right">금액</th>
                    <th>메모</th>
                    {canEdit && <th />}
                  </tr>
                </thead>
                <tbody>
                  {offerings.map((o) => (
                    <tr key={o.id}>
                      <td className="tnum whitespace-nowrap text-ink-2">{ymd(o.date)}</td>
                      <td className="font-medium text-ink">{o.account.name}</td>
                      <td>
                        {o.member ? (
                          <Link
                            href={`/members/${o.member.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {o.member.name}
                          </Link>
                        ) : (
                          <span className="text-ink-2">{o.donorName ?? "무명"}</span>
                        )}
                      </td>
                      <td className="text-ink-3">
                        {PAYMENT_METHODS[o.method as PaymentMethod] ?? o.method}
                      </td>
                      <td className="tnum whitespace-nowrap text-right font-semibold text-ink">
                        {won(o.amount)}
                      </td>
                      <td className="max-w-[12rem] truncate text-ink-3">{o.note ?? ""}</td>
                      {canEdit && (
                        <td className="text-right">
                          <Link
                            href={`/finance/offerings/${o.id}`}
                            className="text-sm font-semibold text-primary hover:underline"
                          >
                            수정
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>

          <ul className="card divide-y divide-line sm:hidden">
            {offerings.map((o) => (
              <li key={o.id}>
                <Link
                  href={canEdit ? `/finance/offerings/${o.id}` : "#"}
                  className="flex items-center gap-3 p-3.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {o.account.name}
                    </span>
                    <span className="tnum block truncate text-xs text-ink-3">
                      {ymd(o.date)} · {o.member?.name ?? o.donorName ?? "무명"}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-sm font-semibold text-income">
                    {won(o.amount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {totalPages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={hrefWith({ page: page - 1 })} className="btn btn-ghost btn-sm">
              이전
            </Link>
          )}
          <span className="tnum px-2 text-sm text-ink-3">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={hrefWith({ page: page + 1 })} className="btn btn-ghost btn-sm">
              다음
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
