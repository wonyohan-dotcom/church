"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePastoral } from "@/lib/auth";
import { VISIT_KINDS } from "@/lib/constants";
import { parseDate, str } from "@/lib/format";

export async function createVisit(memberId: string, formData: FormData) {
  const user = await requirePastoral();
  const member = await prisma.member.findFirst({
    where: { id: memberId, churchId: user.churchId },
    select: { id: true },
  });
  if (!member) redirect("/visits");

  const date = parseDate(formData.get("date"));
  const content = str(formData.get("content"));
  const kindRaw = String(formData.get("kind") ?? "VISIT");
  const kind = kindRaw in VISIT_KINDS ? kindRaw : "VISIT";
  if (!date || !content) redirect(`/members/${memberId}?error=visit#visits`);

  await prisma.visit.create({
    data: {
      churchId: user.churchId,
      memberId,
      date,
      kind,
      content: content.slice(0, 5000),
      prayer: str(formData.get("prayer"))?.slice(0, 2000) ?? null,
      createdById: user.id,
    },
  });

  revalidatePath(`/members/${memberId}`);
  revalidatePath("/visits");
  revalidatePath("/dashboard");
  redirect(`/members/${memberId}?ok=visit#visits`);
}

export async function deleteVisit(id: string) {
  const user = await requirePastoral();
  const visit = await prisma.visit.findFirst({ where: { id, churchId: user.churchId } });
  if (!visit) redirect("/visits");
  await prisma.visit.delete({ where: { id } });
  revalidatePath(`/members/${visit.memberId}`);
  revalidatePath("/visits");
  redirect(`/members/${visit.memberId}#visits`);
}
