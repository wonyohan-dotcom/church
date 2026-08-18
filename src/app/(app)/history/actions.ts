"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/church";
import { deleteImage, saveImage } from "@/lib/upload";
import { parseDate, str } from "@/lib/format";
import { MAX_HISTORY_PHOTOS } from "@/lib/constants";

function readForm(formData: FormData) {
  return {
    date: parseDate(formData.get("date")),
    dateIsApprox: formData.get("dateIsApprox") === "1",
    title: str(formData.get("title")) ?? "",
    category: str(formData.get("category")) ?? "GENERAL",
    content: str(formData.get("content")),
    pinned: formData.get("pinned") === "1",
  };
}

export async function createHistoryEvent(formData: FormData) {
  const user = await requireStaff();
  const data = readForm(formData);

  if (!data.title || !data.date) redirect("/history/new?error=input");

  const event = await prisma.historyEvent.create({
    data: { ...data, churchId: user.churchId, date: data.date },
  });

  await logAudit({
    churchId: user.churchId,
    action: "CREATE",
    entity: "HistoryEvent",
    entityId: event.id,
    summary: `연혁 등록: ${event.title}`,
    userId: user.id,
  });

  revalidatePath("/history");
  redirect(`/history/${event.id}`);
}

export async function updateHistoryEvent(id: string, formData: FormData) {
  const user = await requireStaff();
  const data = readForm(formData);

  if (!data.title || !data.date) redirect(`/history/${id}/edit?error=input`);

  const existing = await prisma.historyEvent.findUnique({ where: { id } });
  if (!existing || existing.churchId !== user.churchId) redirect("/history");

  await prisma.historyEvent.update({
    where: { id },
    data: { ...data, date: data.date },
  });

  await logAudit({
    churchId: user.churchId,
    action: "UPDATE",
    entity: "HistoryEvent",
    entityId: id,
    summary: `연혁 수정: ${data.title}`,
    userId: user.id,
  });

  revalidatePath("/history");
  revalidatePath(`/history/${id}`);
  redirect(`/history/${id}`);
}

export async function deleteHistoryEvent(id: string) {
  const user = await requireStaff();

  const event = await prisma.historyEvent.findUnique({
    where: { id },
    include: { photos: true },
  });
  if (!event || event.churchId !== user.churchId) redirect("/history");

  // 연혁을 지우면 붙어 있던 사진 파일도 함께 정리한다.
  for (const photo of event.photos) await deleteImage(photo.url);
  await prisma.historyPhoto.deleteMany({ where: { eventId: id } });
  await prisma.historyEvent.delete({ where: { id } });

  await logAudit({
    churchId: user.churchId,
    action: "DELETE",
    entity: "HistoryEvent",
    entityId: id,
    summary: `연혁 삭제: ${event.title}`,
    userId: user.id,
  });

  revalidatePath("/history");
  redirect("/history");
}

/**
 * 사진을 한 장씩 올린다.
 *
 * 여러 장을 한 번에 묶어 보내면 Vercel 이 요청 하나당 정해 둔 크기 한도(4.5MB)를
 * 쉽게 넘는다. 폰 카메라 사진 몇 장만 모여도 그 한도를 넘기므로, 화면에서 한 장씩
 * 순서대로 이 함수를 호출해 올린다.
 */
export async function addHistoryPhoto(eventId: string, formData: FormData) {
  const user = await requireStaff();

  const event = await prisma.historyEvent.findUnique({ where: { id: eventId } });
  if (!event || event.churchId !== user.churchId) {
    throw new Error("연혁을 찾을 수 없습니다.");
  }

  const count = await prisma.historyPhoto.count({ where: { eventId } });
  if (count >= MAX_HISTORY_PHOTOS) {
    throw new Error(`사진은 최대 ${MAX_HISTORY_PHOTOS}장까지 붙일 수 있습니다.`);
  }

  const url = await saveImage(formData.get("photo"), "history");
  if (!url) return;

  await prisma.historyPhoto.create({
    data: {
      churchId: user.churchId,
      eventId,
      url,
      caption: str(formData.get("caption")) ?? null,
      sortOrder: count,
    },
  });

  revalidatePath(`/history/${eventId}`);
  revalidatePath("/history");
}

export async function deleteHistoryPhoto(photoId: string) {
  const user = await requireStaff();

  const photo = await prisma.historyPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.churchId !== user.churchId) return;

  await prisma.historyPhoto.delete({ where: { id: photoId } });
  await deleteImage(photo.url);

  if (photo.eventId) revalidatePath(`/history/${photo.eventId}`);
  revalidatePath("/history");
}
