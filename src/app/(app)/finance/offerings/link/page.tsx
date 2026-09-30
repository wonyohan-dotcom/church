import Link from "next/link";
import { requireFinance } from "@/lib/auth";
import { findLinkable, searchByWrittenName } from "@/lib/offering-givers";
import { prisma } from "@/lib/prisma";
import { GiverPickerProvider } from "@/components/giver-picker";
import { NameGroups } from "./name-groups";
import { won } from "@/lib/format";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { IconUsers } from "@/components/icons";
import { linkOfferingsByName } from "../../actions";

export const metadata = { title: "이름으로 헌금자 연결" };

export default async function LinkOfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; q?: string }>;
}) {
  const staff = await requireFinance();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const [groups, found, members] = await Promise.all([
    q ? Promise.resolve([]) : findLinkable(staff.churchId),
    q ? searchByWrittenName(staff.churchId, q) : Promise.resolve([]),
    q
      ? prisma.member.findMany({
          where: { churchId: staff.churchId },
          select: { id: true, name: true, position: true, status: true, district: { select: { name: true } } },
          orderBy: [{ status: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
  ]);
  const count = groups.reduce((s, g) => s + g.offeringIds.length, 0);

  const searchBox = (
    <form method="get" className="card mb-5 flex gap-2 p-3">
      <input
        name="q"
        type="search"
        defaultValue={q}
        required
        placeholder="교인 이름이나 적힌 이름 (예: 홍지성, 지성)"
        className="field min-w-0 flex-1"
        enterKeyHint="search"
      />
      <button type="submit" className="btn btn-primary shrink-0">
        찾기
      </button>
    </form>
  );

  if (q) {
    return (
      <GiverPickerProvider
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          sub: [m.position, m.district?.name, m.status !== "ACTIVE" ? "(비활동)" : null].filter(Boolean).join(" · "),
        }))}
      >
        <PageHeader
          title="이름으로 헌금자 연결"
          description="적힌 이름마다 교인을 골라 한 번에 잇습니다. 두 분을 고르면 두 분 모두의 헌금으로 보입니다."
          back={{ href: "/finance/offerings/link", label: "자동으로 찾은 헌금" }}
        />
        {searchBox}
        {found.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconUsers />}
              title={`‘${q}’ 이(가) 들어간 적힌 이름이 없습니다`}
              description="다른 글자로 찾아보세요. 교인 이름(예: 홍지성)으로 찾으면 성을 뺀 이름(지성)도 함께 찾습니다."
            />
          </Card>
        ) : (
          <>
            <p className="mb-2 px-1 text-sm text-ink-2">
              ‘{q}’ 이(가) 들어간 적힌 이름 <b>{found.length}가지</b> · 헌금{" "}
              {found.reduce((s, g) => s + g.offeringIds.length, 0)}건
            </p>
            <NameGroups groups={found} />
          </>
        )}
      </GiverPickerProvider>
    );
  }

  return (
    <>
      <PageHeader
        title="이름으로 헌금자 연결"
        description="통장·엑셀에 적힌 이름 속에서 교인을 찾아 헌금을 이어 줍니다. 두 분 이름이 함께 적힌 헌금은 두 분 모두에게 보입니다."
        back={{ href: "/finance/offerings", label: "헌금 내역" }}
      />
      {searchBox}

      {sp.ok !== undefined && (
        <div className="mb-5">
          <Alert tone="income">헌금 {Number(sp.ok) || 0}건을 교인과 이었습니다.</Alert>
        </div>
      )}

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconUsers />}
            title="이을 헌금이 없습니다"
            description="이름으로 찾을 수 있는 헌금은 모두 교인과 이어져 있습니다. 나머지는 헌금 내역에서 줄을 꾹 눌러 직접 고를 수 있습니다."
            action={
              <Link href="/finance/offerings" className="btn btn-ghost">
                헌금 내역으로
              </Link>
            }
          />
        </Card>
      ) : (
        <form action={linkOfferingsByName}>
          <p className="mb-3 px-1 text-sm text-ink-2">
            {groups.length}가지 이름 · 헌금 <b>{count}건</b>을 찾았습니다. 틀린 것은 체크를 풀어 주세요.
          </p>
          <ul className="card divide-y divide-line">
            {groups.map((g) => (
              <li key={g.donorName}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    name="name"
                    value={g.donorName}
                    defaultChecked
                    className="size-5 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink-3">“{g.donorName}”</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 font-semibold text-ink">
                      → {g.memberNames.join(" · ")}
                      {g.memberNames.length > 1 && <Badge tone="accent">함께 드림</Badge>}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-right text-sm">
                    <span className="block font-semibold text-income">{won(g.total)}</span>
                    <span className="block text-xs text-ink-3">{g.offeringIds.length}건</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="sticky bottom-20 mt-4 flex justify-end lg:bottom-4">
            <SubmitButton className="btn btn-primary shadow-lg" pendingLabel="잇는 중…">
              체크한 헌금 교인과 잇기
            </SubmitButton>
          </div>
          <p className="mt-3 px-1 text-xs text-ink-3">
            헌금 항목(십일조·감사헌금 등)만 찾습니다. 내부이체·환불·참가비는 헌금자와 잇지 않습니다.
            함께 드린 헌금의 기부금영수증은 맨 앞 이름의 교인에게 들어갑니다.
          </p>
        </form>
      )}
    </>
  );
}
