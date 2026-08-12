import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { MEMBER_STATUS, POSITIONS, type MemberStatus } from "@/lib/constants";
import { age, phone as fmtPhone, ymd } from "@/lib/format";
import {
  Avatar,
  Badge,
  EmptyState,
  PageHeader,
  StatCard,
  TableWrap,
} from "@/components/ui";
import { IconPlus, IconSearch, IconUsers } from "@/components/icons";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "교적 관리" };

const PAGE_SIZE = 30;

const STATUS_TONE: Record<MemberStatus, "income" | "warn" | "neutral" | "expense"> = {
  ACTIVE: "income",
  INACTIVE: "warn",
  TRANSFERRED: "neutral",
  DECEASED: "neutral",
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    district?: string;
    position?: string;
    page?: string;
  }>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const status = sp.status ?? "ACTIVE";
  const districtId = sp.district ?? "";
  const position = sp.position ?? "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where: Prisma.MemberWhereInput = {
    churchId: staff.churchId,
    ...(status !== "ALL" ? { status } : {}),
    ...(districtId ? { districtId } : {}),
    ...(position ? { position } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { code: { contains: q } },
            { phone: { contains: q } },
            { address: { contains: q } },
          ],
        }
      : {}),
  };

  const [members, total, districts, counts] = await Promise.all([
    prisma.member.findMany({
      where,
      include: { district: true, household: true },
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.member.count({ where }),
    prisma.district.findMany({
      where: { churchId: staff.churchId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.member.groupBy({
      by: ["status"],
      where: { churchId: staff.churchId },
      _count: true,
    }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const activeCount = countOf("ACTIVE");
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [maleCount, femaleCount] = await Promise.all([
    prisma.member.count({
      where: { churchId: staff.churchId, status: "ACTIVE", gender: "M" },
    }),
    prisma.member.count({
      where: { churchId: staff.churchId, status: "ACTIVE", gender: "F" },
    }),
  ]);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "ACTIVE") params.set("status", status);
    if (districtId) params.set("district", districtId);
    if (position) params.set("position", position);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `/members${s ? `?${s}` : ""}`;
  }

  return (
    <>
      <PageHeader
        title="교적 관리"
        description="교인 정보를 등록하고 가정·교구별로 관리합니다."
        actions={
          <>
            <Link href="/members/groups" className="btn btn-ghost">
              교구·가정 관리
            </Link>
            <Link href="/members/new" className="btn btn-primary">
              <IconPlus width={16} height={16} />
              교인 등록
            </Link>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="재적 교인" value={`${activeCount}명`} tone="primary" />
        <StatCard label="남 / 여" value={`${maleCount} / ${femaleCount}`} sub="재적 기준" />
        <StatCard label="장기결석" value={`${countOf("INACTIVE")}명`} />
        <StatCard
          label="이명 · 소천"
          value={`${countOf("TRANSFERRED") + countOf("DECEASED")}명`}
        />
      </div>

      {/* 검색 · 필터 */}
      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[12rem] flex-1">
          <label className="label" htmlFor="q">
            검색
          </label>
          <div className="relative">
            <IconSearch
              width={17}
              height={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              id="q"
              name="q"
              defaultValue={q}
              className="field pl-9"
              placeholder="이름, 교적번호, 전화번호, 주소"
            />
          </div>
        </div>

        <div className="w-[7.5rem]">
          <label className="label" htmlFor="status">
            상태
          </label>
          <select id="status" name="status" defaultValue={status} className="field">
            <option value="ALL">전체</option>
            {Object.entries(MEMBER_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="w-[8.5rem]">
          <label className="label" htmlFor="district">
            교구
          </label>
          <select id="district" name="district" defaultValue={districtId} className="field">
            <option value="">전체</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-[7.5rem]">
          <label className="label" htmlFor="position">
            직분
          </label>
          <select id="position" name="position" defaultValue={position} className="field">
            <option value="">전체</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn-primary">
          검색
        </button>
      </form>

      <p className="mb-2.5 px-1 text-sm text-ink-3">
        총 <span className="font-semibold text-ink">{total}명</span>
        {totalPages > 1 && ` · ${page}/${totalPages} 쪽`}
      </p>

      {members.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconUsers />}
            title="조건에 맞는 교인이 없습니다"
            description="검색어나 필터를 바꿔 보시거나, 새 교인을 등록해 주세요."
            action={
              <Link href="/members/new" className="btn btn-primary">
                <IconPlus width={16} height={16} />
                교인 등록
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* 데스크톱 — 표 */}
          <div className="hidden sm:block">
            <TableWrap>
              <table className="table">
                <thead>
                  <tr>
                    <th>교인</th>
                    <th>직분</th>
                    <th>교구 / 가정</th>
                    <th>연락처</th>
                    <th>등록일</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link
                          href={`/members/${m.id}`}
                          className="flex items-center gap-3 transition-opacity hover:opacity-70"
                        >
                          <Avatar src={m.photoUrl} name={m.name} />
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink">{m.name}</span>
                            <span className="tnum block text-xs text-ink-3">
                              {m.code}
                              {age(m.birthDate) !== null && ` · 만 ${age(m.birthDate)}세`}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="text-ink-2">{m.position ?? "-"}</td>
                      <td className="text-ink-2">
                        {m.district?.name ?? "-"}
                        {m.household && (
                          <span className="block text-xs text-ink-3">{m.household.name}</span>
                        )}
                      </td>
                      <td className="tnum text-ink-2">{fmtPhone(m.phone)}</td>
                      <td className="tnum text-ink-2">{ymd(m.registeredAt)}</td>
                      <td>
                        <Badge tone={STATUS_TONE[m.status as MemberStatus] ?? "neutral"}>
                          {MEMBER_STATUS[m.status as MemberStatus] ?? m.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>

          {/* 모바일 — 카드 목록 */}
          <ul className="card divide-y divide-line sm:hidden">
            {members.map((m) => (
              <li key={m.id}>
                <Link href={`/members/${m.id}`} className="flex items-center gap-3 p-3.5">
                  <Avatar src={m.photoUrl} name={m.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink">{m.name}</span>
                      {m.position && <span className="text-xs text-ink-3">{m.position}</span>}
                    </div>
                    <p className="tnum truncate text-xs text-ink-3">
                      {m.code}
                      {m.phone && ` · ${fmtPhone(m.phone)}`}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[m.status as MemberStatus] ?? "neutral"}>
                    {MEMBER_STATUS[m.status as MemberStatus] ?? m.status}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {totalPages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="btn btn-ghost btn-sm">
              이전
            </Link>
          )}
          <span className="tnum px-2 text-sm text-ink-3">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={pageHref(page + 1)} className="btn btn-ghost btn-sm">
              다음
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
