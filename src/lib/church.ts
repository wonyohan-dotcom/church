import { notFound } from "next/navigation";
import { prisma } from "./prisma";

/** 로그인한 사람이 속한 교회 정보를 가져온다. */
export async function getChurch(churchId: string) {
  const church = await prisma.church.findUnique({ where: { id: churchId } });
  if (!church) notFound();
  return church;
}

export async function logAudit(input: {
  churchId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string | null;
  userId?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        churchId: input.churchId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        userId: input.userId ?? null,
      },
    });
  } catch {
    // 감사 로그 실패가 본 작업을 막지 않도록 한다.
  }
}

/**
 * 어떤 자료가 정말 그 교회 것인지 확인한다.
 * 주소창에 남의 교회 자료 ID를 넣어도 열리지 않도록 모든 상세 화면에서 쓴다.
 */
export function assertSameChurch(
  record: { churchId: string } | null | undefined,
  churchId: string,
) {
  if (!record || record.churchId !== churchId) notFound();
  return record;
}
