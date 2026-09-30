import { prisma } from "./prisma";
import { canLinkGivers, matchGivers, type NamedMember } from "./givers";
import type { Prisma } from "@/generated/prisma/client";

/**
 * 헌금자 연결
 *  - 대표 헌금자는 Offering.memberId, 함께 드린 교인은 OfferingGiver 에 둔다.
 *  - 교인별 헌금 내역에는 둘 다 보인다. 기부금영수증은 대표 헌금자에게만 들어간다.
 */

/** 이 교인이 드린 헌금 (혼자 또는 함께) */
export function givenBy(memberId: string): Prisma.OfferingWhereInput {
  return { OR: [{ memberId }, { coGivers: { some: { memberId } } }] };
}

/** 목록에 헌금자 이름을 보여주기 위해 함께 불러올 것 */
export const giverInclude = {
  member: { select: { id: true, name: true } },
  coGivers: { select: { member: { select: { id: true, name: true } } } },
} satisfies Prisma.OfferingInclude;

type WithGivers = {
  member: { id: string; name: string } | null;
  coGivers: { member: { id: string; name: string } }[];
  donorName: string | null;
};

/** 헌금자 전부 (대표 먼저) */
export function giversOf(o: WithGivers) {
  return [...(o.member ? [o.member] : []), ...o.coGivers.map((g) => g.member)];
}

/** 목록에 쓸 헌금자 이름: "김동진 · 최창일", 교인이 아니면 적힌 이름, 없으면 무명 */
export function giverLabel(o: WithGivers) {
  const people = giversOf(o);
  return people.length ? people.map((p) => p.name).join(" · ") : (o.donorName ?? "무명");
}

export async function churchMembers(churchId: string): Promise<NamedMember[]> {
  return prisma.member.findMany({ where: { churchId }, select: { id: true, name: true } });
}

/**
 * 헌금자를 정한다. ids[0] 이 대표, 나머지는 함께 드린 교인. 빈 배열이면 무명.
 * 이 교회 교인이 아닌 id 는 버린다.
 */
export async function setGivers(
  churchId: string,
  offeringId: string,
  ids: string[],
  opts: { confirmed: boolean },
) {
  const unique = [...new Set(ids)];
  const valid = unique.length
    ? await prisma.member.findMany({ where: { churchId, id: { in: unique } }, select: { id: true } })
    : [];
  const ok = unique.filter((id) => valid.some((v) => v.id === id));

  await prisma.$transaction([
    prisma.offering.update({
      where: { id: offeringId },
      data: { memberId: ok[0] ?? null, giversConfirmed: opts.confirmed },
    }),
    prisma.offeringGiver.deleteMany({ where: { offeringId } }),
    prisma.offeringGiver.createMany({
      data: ok.slice(1).map((memberId) => ({ offeringId, memberId })),
    }),
  ]);
  return ok;
}

export type LinkSuggestion = {
  donorName: string;
  memberIds: string[];
  memberNames: string[];
  offeringIds: string[];
  total: number;
};

/**
 * 아직 교인과 이어지지 않은 헌금 가운데, 적힌 이름으로 교인을 찾을 수 있는 것.
 * 내부이체·환불·이자는 헌금자와 잇지 않는다. (canLinkGivers)
 * 사람이 직접 고른 헌금(giversConfirmed)은 건드리지 않는다.
 */
export async function findLinkable(churchId: string): Promise<LinkSuggestion[]> {
  const [offerings, members] = await Promise.all([
    prisma.offering.findMany({
      where: {
        churchId,
        memberId: null,
        giversConfirmed: false,
        donorName: { not: null },
      },
      select: { id: true, donorName: true, amount: true, account: { select: { name: true } } },
    }),
    churchMembers(churchId),
  ]);
  const nameOf = new Map(members.map((m) => [m.id, m.name]));

  const groups = new Map<string, LinkSuggestion>();
  for (const o of offerings) {
    if (!canLinkGivers(o.account.name)) continue;
    const ids = matchGivers(o.donorName, members);
    if (ids.length === 0) continue;
    const g = groups.get(o.donorName!) ?? {
      donorName: o.donorName!,
      memberIds: ids,
      memberNames: ids.map((id) => nameOf.get(id) ?? ""),
      offeringIds: [],
      total: 0,
    };
    g.offeringIds.push(o.id);
    g.total += o.amount;
    groups.set(o.donorName!, g);
  }
  return [...groups.values()].sort((a, b) => b.offeringIds.length - a.offeringIds.length);
}

/** 새로 적는 헌금: 교인을 고르지 않았으면 적힌 이름으로 찾아 잇는다 (내부이체 등은 빼고). */
export async function autoLinkGivers(
  churchId: string,
  offeringId: string,
  donorName: string | null,
  accountId: string,
) {
  if (!donorName) return;
  const account = await prisma.account.findFirst({
    where: { id: accountId, churchId },
    select: { name: true },
  });
  if (!account || !canLinkGivers(account.name)) return;
  const ids = matchGivers(donorName, await churchMembers(churchId));
  if (ids.length) await setGivers(churchId, offeringId, ids, { confirmed: false });
}

export type NameSearchGroup = {
  donorName: string;
  offeringIds: string[];
  total: number;
  current: { id: string; name: string }[];
  mixed: boolean;
  linkedCount: number;
  suggested: { id: string; name: string }[];
};

/**
 * 적힌 이름(통장 입금자명·엑셀 이름)에 검색어가 들어간 헌금을 이름별로 묶는다.
 * 교인 이름으로 찾으면(예: 홍지성) 성을 뺀 이름(지성)으로 적힌 헌금도 함께 찾는다.
 */
export async function searchByWrittenName(churchId: string, q: string): Promise<NameSearchGroup[]> {
  const term = q.replace(/\s/g, "").slice(0, 20);
  if (!term) return [];
  const members = await churchMembers(churchId);
  const byId = new Map(members.map((m) => [m.id, m.name]));
  const searched = members.filter((m) => m.name.replace(/\s/g, "") === term);
  const terms = new Set([term]);
  if (searched.length === 1 && /^[가-힣]{3}$/.test(term)) terms.add(term.slice(1));

  const offerings = await prisma.offering.findMany({
    where: {
      churchId,
      OR: [...terms].map((t) => ({ donorName: { contains: t, mode: "insensitive" as const } })),
    },
    select: {
      id: true,
      amount: true,
      donorName: true,
      memberId: true,
      account: { select: { name: true } },
      coGivers: { select: { memberId: true } },
    },
    take: 3000,
  });

  const groups = new Map<string, { ids: string[]; total: number; givers: string[] }>();
  for (const o of offerings) {
    if (!o.donorName || !canLinkGivers(o.account.name)) continue;
    const g = groups.get(o.donorName) ?? { ids: [], total: 0, givers: [] };
    g.ids.push(o.id);
    g.total += o.amount;
    g.givers.push([o.memberId, ...o.coGivers.map((c) => c.memberId)].filter(Boolean).join(","));
    groups.set(o.donorName, g);
  }

  const named = (ids: string[]) => ids.map((id) => ({ id, name: byId.get(id) ?? "?" }));
  return [...groups.entries()]
    .map(([donorName, g]) => {
      const mixed = new Set(g.givers).size > 1;
      const current = !mixed && g.givers[0] ? named(g.givers[0].split(",")) : [];
      let suggested = matchGivers(donorName, members);
      // "지성" 처럼 이름 한 단어만 적혔어도, 그 교인을 찾아 들어왔다면 그 교인을 추천한다.
      if (!suggested.length && searched.length === 1) suggested = [searched[0].id];
      return {
        donorName,
        offeringIds: g.ids,
        total: g.total,
        current,
        mixed,
        linkedCount: g.givers.filter(Boolean).length,
        suggested: named(suggested),
      };
    })
    .sort((a, b) => Number(a.linkedCount === a.offeringIds.length) - Number(b.linkedCount === b.offeringIds.length) || b.offeringIds.length - a.offeringIds.length)
    .slice(0, 100);
}
