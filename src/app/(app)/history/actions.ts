"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/church";
import { deleteImage, saveImage } from "@/lib/upload";
import { parseDate, str } from "@/lib/format";

const MAX_PHOTOS = 10;

/** 폼에 담긴 사진들을 저장해 연혁에 붙인다. */
async function attachPhotos(churchId: string, eventId: string, formData: FormData) {
  const files = formData.getAll("photos").slice(0, MAX_PHOTOS);
  const captions = formData.getAll("photoCaption");

  let sortOrder = await prisma.historyPhoto.count({ where: { eventId } });

  for (const [i, file] of files.entries()) {
    const url = await saveImage(file, "history");
    if (!url) continue;
    await prisma.historyPhoto.create({
      data: {
        churchId,
        eventId,
        url,
        caption: typeof captions[i] === "string" ? (captions[i] as string) || null : null,
        sortOrder: sortOrder++,
      },
    });
  }
}

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

  try {
    await attachPhotos(user.churchId, event.id, formData);
  } catch {
    redirect(`/history/${event.id}?error=photo`);
  }

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

  try {
    await attachPhotos(user.churchId, id, formData);
  } catch {
    redirect(`/history/${id}?error=photo`);
  }

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

export async function deleteHistoryPhoto(photoId: string) {
  const user = await requireStaff();

  const photo = await prisma.historyPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.churchId !== user.churchId) return;

  await prisma.historyPhoto.delete({ where: { id: photoId } });
  await deleteImage(photo.url);

  if (photo.eventId) revalidatePath(`/history/${photo.eventId}`);
  revalidatePath("/history");
}
