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
