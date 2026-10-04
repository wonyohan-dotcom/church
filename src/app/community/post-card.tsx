import { Avatar } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { IconChat } from "@/components/icons";
import { timeAgo } from "@/lib/community";
import { MAX_COMMENT_BODY } from "@/lib/community-limits";
import { ContentMenu } from "./content-menu";
import { addComment, deleteComment, deletePost } from "./actions";

export type PostView = {
  id: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  author: { id: string; name: string };
  photos: Array<{ id: string; url: string }>;
  comments: Array<{ id: string; body: string; createdAt: Date; author: { id: string; name: string } }>;
};

/** 사진 글 한 장. 사진은 화면 너비로 크게, 여러 장이면 옆으로 넘겨 본다. */
export function PostCard({
  post,
  meId,
  canModerate,
  canPin,
}: {
  post: PostView;
  meId: string;
  canModerate: boolean;
  canPin: boolean;
}) {
  const earlier = post.comments.slice(0, -2);
  const latest = post.comments.slice(-2);
  const comment = (c: PostView["comments"][number]) => (
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
        meId={meId}
        canModerate={canModerate}
        deleteAction={deleteComment}
      />
    </li>
  );

  return (
    <article id={`post-${post.id}`} className="card scroll-mt-40 overflow-hidden">
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
          meId={meId}
          canModerate={canModerate}
          deleteAction={deletePost}
          pin={canPin ? { pinned: post.pinned } : undefined}
        />
      </div>

      {post.photos.length > 0 && (
        <div className="relative mt-3">
          <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {post.photos.map((ph) => (
              <a key={ph.id} href={ph.url} className="aspect-square w-full shrink-0 snap-center bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
          {post.photos.length > 1 && (
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white">
              {post.photos.length}장 · 옆으로 넘겨 보기
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 px-4 pt-3 text-ink">
        <IconChat width={20} height={20} className="text-ink-2" />
        <span className="tnum text-sm font-bold">{post.comments.length}</span>
      </div>
      {post.body && <p className="whitespace-pre-wrap px-4 pt-2 text-[0.95rem] leading-relaxed text-ink">{post.body}</p>}

      <div className="mt-3 border-t border-line px-4 py-3">
        {earlier.length > 0 && (
          <details className="mb-2">
            <summary className="cursor-pointer list-none text-sm font-semibold text-ink-3 [&::-webkit-details-marker]:hidden">
              댓글 {post.comments.length}개 모두 보기
            </summary>
            <ul className="mt-2 space-y-2.5">{earlier.map(comment)}</ul>
          </details>
        )}
        {latest.length > 0 && <ul className="mb-3 space-y-2.5">{latest.map(comment)}</ul>}
        <form action={addComment} className="flex items-center gap-2">
          <input type="hidden" name="postId" value={post.id} />
          <input name="body" className="field min-w-0 flex-1" placeholder="댓글 달기" maxLength={MAX_COMMENT_BODY} autoComplete="off" required />
          <SubmitButton className="btn btn-ghost btn-sm shrink-0" pendingLabel="…">
            등록
          </SubmitButton>
        </form>
      </div>
    </article>
  );
}
