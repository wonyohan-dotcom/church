import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCommunityUser, blockedIdsOf, isModerator, timeAgo } from "@/lib/community";
import { MAX_COMMENT_BODY } from "@/lib/community-limits";
import { Avatar, EmptyState } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { PostComposer } from "./post-composer";
import { ContentMenu } from "./content-menu";
import { addComment, deleteComment, deletePost } from "./actions";

export const dynamic = "force-dynamic";
const PAGE = 15;

export default async function CommunityPhotos({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const user = await requireCommunityUser();
  const take = Math.min(120, Math.max(PAGE, Number((await searchParams).n) || PAGE));
  const blocked = await blockedIdsOf(user.id);
  const notBlocked = blocked.length ? { notIn: blocked } : undefined;

  const [posts, openReports, blockedCount] = await Promise.all([
    prisma.post.findMany({
      where: { churchId: user.churchId, authorId: notBlocked },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      include: {
        author: { select: { id: true, name: true } },
        photos: { orderBy: { sortOrder: "asc" } },
        comments: {
          where: { authorId: notBlocked },
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true } } },
        },
      },
    }),
    isModerator(user) ? prisma.contentReport.count({ where: { churchId: user.churchId, resolved: false } }) : 0,
    blocked.length,
  ]);
  const more = posts.length > take;
  const shown = posts.slice(0, take);
  const canModerate = isModerator(user);

  return (
    <div className="space-y-4">
      <PostComposer />

      {(canModerate || blockedCount > 0) && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
          {canModerate && (
            <Link href="/community/reports" className="font-semibold text-primary">
              신고 확인{openReports > 0 ? ` (${openReports})` : ""}
            </Link>
          )}
          {blockedCount > 0 && (
            <Link href="/community/blocked" className="font-semibold text-ink-2">
              차단한 사람 {blockedCount}명
            </Link>
          )}
        </p>
      )}

      {shown.length === 0 ? (
        <EmptyState title="아직 올라온 글이 없습니다" description="첫 사진이나 한마디를 올려 보세요." />
      ) : (
        shown.map((post) => (
          <article key={post.id} className="card overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 pt-4">
              <Avatar name={post.author.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{post.author.name}</p>
                <p className="text-xs text-ink-3">{timeAgo(post.createdAt)}</p>
              </div>
              <ContentMenu
                kind="POST"
                targetId={post.id}
                authorId={post.author.id}
                meId={user.id}
                canModerate={canModerate}
                deleteAction={deletePost}
              />
            </div>

            {post.photos.length > 0 && (
              <div className={`mt-3 grid gap-0.5 ${post.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {post.photos.map((ph, i) => (
                  <a
                    key={ph.id}
                    href={ph.url}
                    className={`block overflow-hidden bg-surface-2 ${
                      post.photos.length === 1 ? "aspect-[4/3]" : "aspect-square"
                    } ${post.photos.length === 3 && i === 0 ? "col-span-2 !aspect-[2/1]" : ""}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            )}

            {post.body && <p className="whitespace-pre-wrap px-4 pt-3 text-[0.95rem] leading-relaxed text-ink">{post.body}</p>}

            <div className="mt-3 border-t border-line px-4 py-3">
              {post.comments.length > 0 && (
                <ul className="mb-3 space-y-2.5">
                  {post.comments.map((c) => (
                    <li key={c.id} className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink-2">
                        <b className="mr-1.5 text-ink">{c.author.name}</b>
                        <span className="whitespace-pre-wrap break-words">{c.body}</span>
                        <span className="ml-1.5 text-xs text-ink-3">{timeAgo(c.createdAt)}</span>
                      </p>
                      <ContentMenu
                        kind="COMMENT"
                        targetId={c.id}
                        authorId={c.author.id}
                        meId={user.id}
                        canModerate={canModerate}
                        deleteAction={deleteComment}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <form action={addComment} className="flex items-center gap-2">
                <input type="hidden" name="postId" value={post.id} />
                <input
                  name="body"
                  className="field min-w-0 flex-1"
                  placeholder="댓글 달기"
                  maxLength={MAX_COMMENT_BODY}
                  autoComplete="off"
                  required
                />
                <SubmitButton className="btn btn-ghost btn-sm shrink-0" pendingLabel="…">
                  등록
                </SubmitButton>
              </form>
            </div>
          </article>
        ))
      )}

      {more && (
        <Link href={`/community?n=${take + PAGE}`} replace scroll={false} className="btn btn-ghost w-full">
          더 보기
        </Link>
      )}
    </div>
  );
}
