"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isStaff, requireStaff, requireUser } from "@/lib/auth";
import {
  MAX_COMMENT_BODY,
  MAX_POST_BODY,
  MAX_POST_PHOTOS,
  REPORT_REASONS,
  isModerator,
  requireCommunityUser,
} from "@/lib/community";
import { parseDate, str } from "@/lib/format";
import { copyImage, deleteImage, saveImage } from "@/lib/upload";
import { HISTORY_CATEGORIES, MAX_HISTORY_PHOTOS } from "@/lib/constants";
import { logAudit } from "@/lib/church";
import { parseSongLines, youtubePlaylistId } from "@/lib/youtube";

/* ── 이용 약관 동의 ─────────────────────── */

export async function agreeCommunity() {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { communityAgreedAt: new Date() } });
  revalidatePath("/community", "layout");
  redirect("/community");
}

/* ── 사진 글 ────────────────────────────── */

/** 글을 만들고 id 를 돌려준다. 사진은 한 장씩 addPostPhoto 로 따로 올린다(요청 크기 한도 때문). */
export async function createPost(formData: FormData): Promise<{ id?: string; error?: string }> {
  const user = await requireCommunityUser();
  const body = (str(formData.get("body")) ?? "").slice(0, MAX_POST_BODY);
  const hasPhoto = formData.get("hasPhoto") === "1";
  if (!body && !hasPhoto) return { error: "사진이나 글을 넣어 주세요." };

  const pinned = formData.get("pinned") === "1" && isStaff(user.role);
  const post = await prisma.post.create({ data: { churchId: user.churchId, authorId: user.id, body, pinned } });
  revalidatePath("/community");
  return { id: post.id };
}

export async function addPostPhoto(postId: string, formData: FormData) {
  const user = await requireCommunityUser();
  const post = await prisma.post.findUnique({ where: { id: postId }, include: { _count: { select: { photos: true } } } });
  if (!post || post.churchId !== user.churchId || post.authorId !== user.id) throw new Error("글을 찾을 수 없습니다.");
  if (post._count.photos >= MAX_POST_PHOTOS) throw new Error(`사진은 최대 ${MAX_POST_PHOTOS}장까지 올릴 수 있습니다.`);

  const url = await saveImage(formData.get("photo"), "community");
  if (!url) return;
  await prisma.postPhoto.create({ data: { postId, url, sortOrder: post._count.photos } });
  revalidatePath("/community");
}

export async function deletePost(formData: FormData) {
  const user = await requireCommunityUser();
  const post = await prisma.post.findUnique({ where: { id: String(formData.get("id")) }, include: { photos: true } });
  if (!post || post.churchId !== user.churchId) return;
  if (post.authorId !== user.id && !isModerator(user)) return;
  await prisma.post.delete({ where: { id: post.id } });
  for (const p of post.photos) await deleteImage(p.url);
  revalidatePath("/community");
}

/** 공지로 고정하거나 해제한다 (교역자·관리자). */
export async function togglePin(formData: FormData) {
  const user = await requireStaff();
  const post = await prisma.post.findFirst({ where: { id: String(formData.get("id")), churchId: user.churchId } });
  if (!post) return;
  await prisma.post.update({ where: { id: post.id }, data: { pinned: !post.pinned } });
  revalidatePath("/community");
}

/* ── 댓글 ───────────────────────────────── */

export async function addComment(formData: FormData) {
  const user = await requireCommunityUser();
  const postId = String(formData.get("postId") ?? "");
  const body = (str(formData.get("body")) ?? "").slice(0, MAX_COMMENT_BODY);
  if (!body) return;
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { churchId: true } });
  if (!post || post.churchId !== user.churchId) return;
  await prisma.postComment.create({ data: { postId, authorId: user.id, body } });
  revalidatePath("/community");
}

export async function deleteComment(formData: FormData) {
  const user = await requireCommunityUser();
  const comment = await prisma.postComment.findUnique({
    where: { id: String(formData.get("id")) },
    include: { post: { select: { churchId: true } } },
  });
  if (!comment || comment.post.churchId !== user.churchId) return;
  if (comment.authorId !== user.id && !isModerator(user)) return;
  await prisma.postComment.delete({ where: { id: comment.id } });
  revalidatePath("/community");
}

/* ── 신고 · 차단 ────────────────────────── */

async function targetAuthor(user: { churchId: string }, kind: string, id: string) {
  if (kind === "POST") {
    const t = await prisma.post.findUnique({ where: { id } });
    return t && t.churchId === user.churchId ? { authorId: t.authorId, excerpt: t.body } : null;
  }
  if (kind === "COMMENT") {
    const t = await prisma.postComment.findUnique({ where: { id }, include: { post: { select: { churchId: true } } } });
    return t && t.post.churchId === user.churchId ? { authorId: t.authorId, excerpt: t.body } : null;
  }
  if (kind === "CHAT") {
    const t = await prisma.chatMessage.findUnique({ where: { id } });
    return t && t.churchId === user.churchId ? { authorId: t.authorId, excerpt: t.body } : null;
  }
  return null;
}

export async function reportContent(formData: FormData) {
  const user = await requireCommunityUser();
  const kind = String(formData.get("kind") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const reason = str(formData.get("reason"));
  const target = await targetAuthor(user, kind, targetId);
  if (!target || target.authorId === user.id) return;
  const already = await prisma.contentReport.findFirst({ where: { reporterId: user.id, kind, targetId } });
  if (!already) {
    await prisma.contentReport.create({
      data: {
        churchId: user.churchId,
        reporterId: user.id,
        kind,
        targetId,
        reason: reason && (REPORT_REASONS as readonly string[]).includes(reason) ? reason : "기타",
        excerpt: target.excerpt.slice(0, 300),
      },
    });
  }
  revalidatePath("/community/reports");
}

export async function blockUser(formData: FormData) {
  const user = await requireCommunityUser();
  const blockedId = String(formData.get("userId") ?? "");
  if (!blockedId || blockedId === user.id) return;
  const other = await prisma.user.findUnique({ where: { id: blockedId }, select: { churchId: true } });
  if (!other || other.churchId !== user.churchId) return;
  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
    create: { blockerId: user.id, blockedId },
    update: {},
  });
  revalidatePath("/community", "layout");
}

export async function unblockUser(formData: FormData) {
  const user = await requireCommunityUser();
  await prisma.userBlock.deleteMany({ where: { blockerId: user.id, blockedId: String(formData.get("userId") ?? "") } });
  revalidatePath("/community", "layout");
}

export async function resolveReport(formData: FormData) {
  const user = await requireCommunityUser();
  if (!isModerator(user)) return;
  await prisma.contentReport.updateMany({
    where: { id: String(formData.get("id")), churchId: user.churchId },
    data: { resolved: true },
  });
  revalidatePath("/community/reports");
}

/** 신고된 글을 관리자가 지운다 (글 종류에 맞게). */
export async function removeReported(formData: FormData) {
  const user = await requireCommunityUser();
  if (!isModerator(user)) return;
  const report = await prisma.contentReport.findFirst({ where: { id: String(formData.get("id")), churchId: user.churchId } });
  if (!report) return;
  if (report.kind === "POST") {
    const post = await prisma.post.findFirst({ where: { id: report.targetId, churchId: user.churchId }, include: { photos: true } });
    if (post) {
      await prisma.post.delete({ where: { id: post.id } });
      for (const p of post.photos) await deleteImage(p.url);
    }
  } else if (report.kind === "COMMENT") {
    await prisma.postComment.deleteMany({ where: { id: report.targetId, post: { churchId: user.churchId } } });
  } else if (report.kind === "CHAT") {
    await prisma.chatMessage.deleteMany({ where: { id: report.targetId, churchId: user.churchId } });
  }
  await prisma.contentReport.updateMany({ where: { churchId: user.churchId, kind: report.kind, targetId: report.targetId }, data: { resolved: true } });
  revalidatePath("/community", "layout");
}

/* ── 주보 ───────────────────────────────── */

export async function saveBulletin(formData: FormData) {
  const user = await requireStaff();
  const id = str(formData.get("id"));
  const serviceDate = parseDate(formData.get("serviceDate"));
  const title = (str(formData.get("title")) ?? "주일 예배 주보").slice(0, 80);
  const text = (name: string, max: number) => (str(formData.get(name)) ?? "").slice(0, max) || null;
  const playlistRaw = str(formData.get("playlistUrl"));
  const playlistUrl = playlistRaw && youtubePlaylistId(playlistRaw) ? playlistRaw : null;
  const songs = parseSongLines(String(formData.get("songs") ?? ""));

  const back = id ? `/community/bulletin/${id}/edit` : "/community/bulletin/new";
  if (!serviceDate) redirect(`${back}?error=required`);
  if (playlistRaw && !playlistUrl) redirect(`${back}?error=playlist`);

  const data = {
    title,
    serviceDate,
    note: text("note", 500),
    playlistUrl,
    sermonTitle: text("sermonTitle", 120),
    scripture: text("scripture", 120),
    worshipOrder: text("worshipOrder", 1500),
    announcements: text("announcements", 3000),
    prayers: text("prayers", 3000),
  };
  if (!data.note && !data.playlistUrl && !data.sermonTitle && !data.scripture && !data.worshipOrder && !data.announcements && !data.prayers && songs.length === 0) {
    redirect(`${back}?error=empty`);
  }

  let bulletinId = id;
  if (id) {
    const exists = await prisma.setlist.findFirst({ where: { id, churchId: user.churchId } });
    if (!exists) redirect("/community/bulletin");
    await prisma.$transaction([
      prisma.setlist.update({ where: { id }, data }),
      prisma.setlistSong.deleteMany({ where: { setlistId: id } }),
      prisma.setlistSong.createMany({ data: songs.map((s, i) => ({ ...s, setlistId: id, sortOrder: i })) }),
    ]);
  } else {
    const created = await prisma.setlist.create({
      data: { ...data, churchId: user.churchId, songs: { create: songs.map((s, i) => ({ ...s, sortOrder: i })) } },
    });
    bulletinId = created.id;
  }
  revalidatePath("/community/bulletin");
  redirect(`/community/bulletin?id=${bulletinId}`);
}

export async function deleteBulletin(formData: FormData) {
  const user = await requireStaff();
  await prisma.setlist.deleteMany({ where: { id: String(formData.get("id")), churchId: user.churchId } });
  revalidatePath("/community/bulletin");
  redirect("/community/bulletin");
}

/* ── 연혁과 연동 (교역자·관리자가 고른다) ───────────────── */


async function addCopiedPhotosToEvent(churchId: string, eventId: string, urls: string[]) {
  const have = await prisma.historyPhoto.count({ where: { eventId } });
  let order = have;
  for (const url of urls.slice(0, Math.max(0, MAX_HISTORY_PHOTOS - have))) {
    const copy = await copyImage(url, "history");
    if (!copy) continue;
    await prisma.historyPhoto.create({ data: { churchId, eventId, url: copy, sortOrder: order++ } });
  }
}

function readCategory(v: FormDataEntryValue | null) {
  return typeof v === "string" && v in HISTORY_CATEGORIES ? v : "GENERAL";
}

/** 교회 소통의 글(사진)을 연혁에 새로 올리거나, 이미 있는 연혁에 사진을 붙인다. */
export async function postToHistory(formData: FormData) {
  const user = await requireStaff();
  await requireCommunityUser();
  const postId = String(formData.get("postId") ?? "");
  const post = await prisma.post.findFirst({
    where: { id: postId, churchId: user.churchId },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
  });
  if (!post) redirect("/community");

  const chosen = new Set(formData.getAll("photoId").map(String));
  const urls = post.photos.filter((p) => chosen.has(p.id)).map((p) => p.url);
  const back = `/community/post/${post.id}/history`;

  let eventId: string;
  if (formData.get("mode") === "existing") {
    const existing = await prisma.historyEvent.findFirst({ where: { id: String(formData.get("eventId") ?? ""), churchId: user.churchId } });
    if (!existing) redirect(`${back}?error=event`);
    eventId = existing.id;
  } else {
    const title = (str(formData.get("title")) ?? "").slice(0, 100);
    const date = parseDate(formData.get("date"));
    if (!title || !date) redirect(`${back}?error=input`);
    const event = await prisma.historyEvent.create({
      data: {
        churchId: user.churchId,
        title,
        date,
        category: readCategory(formData.get("category")),
        content: (str(formData.get("content")) ?? "").slice(0, 5000) || null,
      },
    });
    eventId = event.id;
    await logAudit({ churchId: user.churchId, action: "CREATE", entity: "HistoryEvent", entityId: event.id, summary: `연혁 등록(교회 소통에서): ${title}`, userId: user.id });
  }
  await addCopiedPhotosToEvent(user.churchId, eventId, urls);
  revalidatePath("/history");
  redirect(`/history/${eventId}`);
}

/** 주보를 연혁으로 기록한다. */
export async function bulletinToHistory(formData: FormData) {
  const user = await requireStaff();
  await requireCommunityUser();
  const id = String(formData.get("bulletinId") ?? "");
  const exists = await prisma.setlist.findFirst({ where: { id, churchId: user.churchId }, select: { id: true } });
  if (!exists) redirect("/community/bulletin");
  const back = `/community/bulletin/${id}/history`;
  const title = (str(formData.get("title")) ?? "").slice(0, 100);
  const date = parseDate(formData.get("date"));
  if (!title || !date) redirect(`${back}?error=input`);
  const event = await prisma.historyEvent.create({
    data: {
      churchId: user.churchId,
      title,
      date,
      category: readCategory(formData.get("category")),
      content: (str(formData.get("content")) ?? "").slice(0, 5000) || null,
    },
  });
  await logAudit({ churchId: user.churchId, action: "CREATE", entity: "HistoryEvent", entityId: event.id, summary: `연혁 등록(주보에서): ${title}`, userId: user.id });
  revalidatePath("/history");
  redirect(`/history/${event.id}`);
}

/** 연혁을 교회 소통(사진·소식)에 올린다. 사진은 복사해서 올린다. */
export async function historyToPost(formData: FormData) {
  const user = await requireStaff();
  const communityUser = await requireCommunityUser();
  const eventId = String(formData.get("eventId") ?? "");
  const event = await prisma.historyEvent.findFirst({
    where: { id: eventId, churchId: user.churchId },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
  });
  if (!event) redirect("/history");
  const chosen = new Set(formData.getAll("photoId").map(String));
  const urls = event.photos.filter((p) => chosen.has(p.id)).map((p) => p.url).slice(0, MAX_POST_PHOTOS);
  const body = (str(formData.get("body")) ?? "").slice(0, MAX_POST_BODY);
  if (!body && urls.length === 0) redirect(`/history/${eventId}/share?error=empty`);

  const post = await prisma.post.create({
    data: { churchId: user.churchId, authorId: communityUser.id, body, pinned: formData.get("pinned") === "1" },
  });
  let order = 0;
  for (const url of urls) {
    const copy = await copyImage(url, "community");
    if (copy) await prisma.postPhoto.create({ data: { postId: post.id, url: copy, sortOrder: order++ } });
  }
  revalidatePath("/community");
  redirect("/community");
}
