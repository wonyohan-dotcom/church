import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/auth";
import { requireCommunityUser, blockedIdsOf, isModerator, timeAgo } from "@/lib/community";
import { EmptyState } from "@/components/ui";
import { IconChat } from "@/components/icons";
import { PostComposer } from "./post-composer";
import { PostCard } from "./post-card";
import { ContentMenu } from "./content-menu";
import { deletePost } from "./actions";

export const dynamic = "force-dynamic";
const PAGE = 12;

export default async function CommunityPhotos({ searchParams }: { searchParams: Promise<{ n?: string; view?: string }> }) {
  const user = await requireCommunityUser();
  const sp = await searchParams;
  const album = sp.view === "album";
  const take = Math.min(120, Math.max(PAGE, Number(sp.n) || PAGE));
  const blocked = await blockedIdsOf(user.id);
  const notBlocked = blocked.length ? { notIn: blocked } : undefined;
  const staff = isStaff(user.role);
  const canModerate = isModerator(user);

  const include = {
    author: { select: { id: true, name: true } },
    photos: { orderBy: { sortOrder: "asc" as const }, select: { id: true, url: true } },
    comments: {
      where: { authorId: notBlocked },
      orderBy: { createdAt: "asc" as const },
      include: { author: { select: { id: true, name: true } } },
    },
  };

  const [notices, posts, openReports] = await Promise.all([
    prisma.post.findMany({
      where: { churchId: user.churchId, pinned: true, authorId: notBlocked },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { author: { select: { id: true, name: true } } },
    }),
    prisma.post.findMany({
      where: {
        churchId: user.churchId,
        authorId: notBlocked,
        ...(album ? { photos: { some: {} } } : { pinned: false }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: album ? 60 : take + 1,
      include: album ? { photos: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { id: true, url: true } }, _count: { select: { comments: true } } } : include,
    }),
    canModerate ? prisma.contentReport.count({ where: { churchId: user.churchId, resolved: false } }) : 0,
  ]);

  return (
    <div className="space-y-4">
      <PostComposer canPin={staff} />

      {notices.map((n) => (
        <section key={n.id} className="rounded-2xl bg-ink p-4 text-bg">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#7ab0ff]">공지</p>
              <p className="mt-1 whitespace-pre-wrap text-[0.95rem] font-semibold leading-relaxed">{n.body || "(사진 공지)"}</p>
              <p className="mt-1.5 text-xs opacity-60">{n.author.name} · {timeAgo(n.createdAt)}</p>
            </div>
            <div className="[&_summary]:text-bg">
              <ContentMenu
                kind="POST"
                targetId={n.id}
                authorId={n.author.id}
                meId={user.id}
                canModerate={canModerate}
                deleteAction={deletePost}
                pin={staff ? { pinned: true } : undefined}
              />
            </div>
          </div>
        </section>
      ))}

      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-xl bg-surface-2 p-1 text-sm font-semibold">
          <Link href="/community" replace className={`rounded-lg px-4 py-1.5 ${album ? "text-ink-3" : "bg-surface text-ink shadow-[var(--shadow-sm)]"}`}>
            피드
          </Link>
          <Link href="/community?view=album" replace className={`rounded-lg px-4 py-1.5 ${album ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink-3"}`}>
            앨범
          </Link>
        </div>
        <p className="flex gap-x-4 text-xs text-ink-3">
          {canModerate && (
            <Link href="/community/reports" className="font-semibold text-primary">
              신고 확인{openReports > 0 ? ` (${openReports})` : ""}
            </Link>
          )}
          <Link href="/community/blocked" className="font-semibold text-ink-3">
            차단 목록
          </Link>
        </p>
      </div>

      {album ? (
        posts.length === 0 ? (
          <EmptyState title="아직 올라온 사진이 없습니다" description="첫 사진을 올려 보세요." />
        ) : (
          <div className="-mx-4 grid grid-cols-3 gap-0.5 sm:mx-0 sm:overflow-hidden sm:rounded-2xl">
            {posts.map((p) => {
              const a = p as unknown as { id: string; photos: Array<{ url: string }>; _count: { comments: number } };
              return (
                <Link key={p.id} href={`/community/post/${p.id}`} className="relative block aspect-square bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.photos[0].url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {a._count.comments > 0 && (
                    <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[0.7rem] font-bold text-white">
                      <IconChat width={11} height={11} />
                      {a._count.comments}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )
      ) : (
        <>
          {posts.length === 0 ? (
            <EmptyState title="아직 올라온 글이 없습니다" description="첫 사진이나 한마디를 올려 보세요." />
          ) : (
            (posts.slice(0, take) as unknown as Array<Parameters<typeof PostCard>[0]["post"]>).map((post) => (
              <PostCard key={post.id} post={post} meId={user.id} canModerate={canModerate} canPin={staff} />
            ))
          )}
          {posts.length > take && (
            <Link href={`/community?n=${take + PAGE}`} replace scroll={false} className="btn btn-ghost w-full">
              더 보기
            </Link>
          )}
        </>
      )}
    </div>
  );
}
