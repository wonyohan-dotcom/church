import { prisma } from "./prisma";

/** 교회 기본 정보는 항상 한 줄만 존재한다. 없으면 만들어서 돌려준다. */
export async function getChurch() {
  const existing = await prisma.churchSetting.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return prisma.churchSetting.create({ data: { id: "singleton" } });
}

export async function logAudit(input: {
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string | null;
  userId?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
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
