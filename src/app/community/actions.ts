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
import { deleteImage, saveImage } from "@/lib/upload";
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

/* ── 이번 주 콘티 ───────────────────────── */

export async function saveSetlist(formData: FormData) {
  const user = await requireStaff();
  const id = str(formData.get("id"));
  const title = (str(formData.get("title")) ?? "").slice(0, 80);
  const serviceDate = parseDate(formData.get("serviceDate"));
  const note = (str(formData.get("note")) ?? "").slice(0, 500) || null;
  const playlistRaw = str(formData.get("playlistUrl"));
  const playlistUrl = playlistRaw && youtubePlaylistId(playlistRaw) ? playlistRaw : null;
  const songs = parseSongLines(String(formData.get("songs") ?? ""));

  const back = id ? `/community/setlist/${id}/edit` : "/community/setlist/new";
  if (!title || !serviceDate) redirect(`${back}?error=required`);
  if (playlistRaw && !playlistUrl) redirect(`${back}?error=playlist`);
  if (songs.length === 0 && !playlistUrl) redirect(`${back}?error=songs`);

  const data = { title, serviceDate, note, playlistUrl };
  let setlistId = id;
  if (id) {
    const exists = await prisma.setlist.findFirst({ where: { id, churchId: user.churchId } });
    if (!exists) redirect("/community/setlist");
    await prisma.$transaction([
      prisma.setlist.update({ where: { id }, data }),
      prisma.setlistSong.deleteMany({ where: { setlistId: id } }),
      prisma.setlistSong.createMany({ data: songs.map((s, i) => ({ ...s, setlistId: id, sortOrder: i })) }),
    ]);
  } else {
    const created = await prisma.setlist.create({
      data: { ...data, churchId: user.churchId, songs: { create: songs.map((s, i) => ({ ...s, sortOrder: i })) } },
    });
    setlistId = created.id;
  }
  revalidatePath("/community/setlist");
  redirect(`/community/setlist?id=${setlistId}`);
}

export async function deleteSetlist(formData: FormData) {
  const user = await requireStaff();
  await prisma.setlist.deleteMany({ where: { id: String(formData.get("id")), churchId: user.churchId } });
  revalidatePath("/community/setlist");
  redirect("/community/setlist");
}
