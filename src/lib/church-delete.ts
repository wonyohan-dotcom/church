import { prisma } from "./prisma";
import { deleteImage } from "./upload";

/**
 * 교회 하나의 자료를 모두 지운다 (교회 삭제 · 체험용 교회 다시 만들기).
 *
 * 헌금·지출은 계정과목을 붙잡고 있어(onDelete 없음) 교회를 바로 지우면 순서에 따라 막힐 수 있다.
 * 그래서 헌금·지출을 먼저 지우고 교회를 지운다. 나머지는 교회를 지우면 함께 지워진다(Cascade).
 * 사진 파일은 자료를 지운 뒤 저장소에서 지운다. 파일 삭제가 실패해도 자료 삭제는 되돌리지 않는다.
 */
export async function deleteChurchData(churchId: string, opts: { keepFiles?: boolean } = {}) {
  const files = opts.keepFiles ? [] : await imageUrls(churchId);

  await prisma.$transaction([
    prisma.bankAlert.deleteMany({ where: { churchId } }),
    prisma.offering.deleteMany({ where: { churchId } }),
    prisma.expense.deleteMany({ where: { churchId } }),
    prisma.church.delete({ where: { id: churchId } }),
  ]);

  for (const url of files) await deleteImage(url);
  return { files: files.length };
}

async function imageUrls(churchId: string) {
  const [church, members, expenses, photos] = await Promise.all([
    prisma.church.findUnique({ where: { id: churchId }, select: { logoUrl: true, sealUrl: true } }),
    prisma.member.findMany({ where: { churchId, photoUrl: { not: null } }, select: { photoUrl: true } }),
    prisma.expense.findMany({ where: { churchId, receiptUrl: { not: null } }, select: { receiptUrl: true } }),
    prisma.historyPhoto.findMany({ where: { churchId }, select: { url: true } }),
  ]);
  return [
    church?.logoUrl,
    church?.sealUrl,
    ...members.map((m) => m.photoUrl),
    ...expenses.map((e) => e.receiptUrl),
    ...photos.map((p) => p.url),
  ].filter((u): u is string => !!u);
}
