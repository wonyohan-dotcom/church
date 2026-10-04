"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { destroySession, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/church";
import { deleteChurchData } from "@/lib/church-delete";
import { isDemoChurch } from "@/lib/demo";
import { otherAdminCount } from "@/lib/church";
import { deleteImage } from "@/lib/upload";

/**
 * 내 계정을 지운다. 로그인 정보와 알림 설정이 지워지고, 교회가 관리하는 교적·헌금 기록은 교회에 남는다.
 * 교회의 마지막 관리자는 교회를 관리할 사람이 없어지므로 계정만 지울 수 없다 (교회 삭제를 쓴다).
 */
export async function deleteMyAccount(formData: FormData) {
  const user = await requireUser();
  if (await isDemoChurch(user.churchId)) redirect("/my/account?error=demo");
  if (String(formData.get("confirm") ?? "").trim() !== "삭제") redirect("/my/account?error=confirm");
  if (user.role === "ADMIN" && (await otherAdminCount(user.churchId, user.id)) === 0) {
    redirect("/my/account?error=last-admin");
  }

  const photos = await prisma.postPhoto.findMany({ where: { post: { authorId: user.id } }, select: { url: true } });
  await prisma.user.delete({ where: { id: user.id } });
  for (const p of photos) await deleteImage(p.url);
  await logAudit({
    churchId: user.churchId,
    action: "DELETE",
    entity: "User",
    entityId: user.id,
    summary: `계정 삭제(본인): ${user.name} (${user.loginId})`,
    userId: null,
  });
  await destroySession();
  redirect("/login?deleted=account");
}

/** 교회와 모든 자료를 지운다. 관리자만, 교회 이름을 그대로 입력했을 때만. */
export async function deleteMyChurch(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/my/account");
  if (await isDemoChurch(user.churchId)) redirect("/my/account?error=demo");

  // 계정 삭제는 누구에게나 같은 절차(‘삭제’ 확인)로 둔다. 마지막 관리자는 교회 자료도 함께 지워진다.
  if (String(formData.get("confirm") ?? "").trim() !== "삭제") redirect("/my/account?error=confirm");

  await deleteChurchData(user.churchId);
  await destroySession();
  redirect("/login?deleted=church");
}
