import { prisma } from "./prisma";

/**
 * 폼으로 넘어온 참조 ID 가 정말 이 교회 것인지 확인한다.
 *
 * 화면에는 우리 교회 항목만 보이지만, 요청은 얼마든지 조작해서 보낼 수 있다.
 * 다른 교회의 교인 ID 를 넣어 헌금을 저장하면 그 교회 기부금영수증 합계가
 * 바뀌어 버리므로, 저장하기 전에 반드시 이 함수들을 거친다.
 * 우리 교회 것이 아니면 null 을 돌려준다.
 */

export async function ownAccountId(
  churchId: string,
  id: string | null,
  type: "INCOME" | "EXPENSE",
): Promise<string | null> {
  if (!id) return null;
  const found = await prisma.account.findFirst({
    where: { id, churchId, type },
    select: { id: true },
  });
  return found?.id ?? null;
}

export async function ownMemberId(churchId: string, id: string | null): Promise<string | null> {
  if (!id) return null;
  const found = await prisma.member.findFirst({ where: { id, churchId }, select: { id: true } });
  return found?.id ?? null;
}

export async function ownDistrictId(churchId: string, id: string | null): Promise<string | null> {
  if (!id) return null;
  const found = await prisma.district.findFirst({ where: { id, churchId }, select: { id: true } });
  return found?.id ?? null;
}

export async function ownHouseholdId(
  churchId: string,
  id: string | null,
): Promise<string | null> {
  if (!id) return null;
  const found = await prisma.household.findFirst({
    where: { id, churchId },
    select: { id: true },
  });
  return found?.id ?? null;
}
