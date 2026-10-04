import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/auth";
import { blockedIdsOf, isModerator, requireCommunityUser } from "@/lib/community";
import { PostCard } from "../../post-card";

export const dynamic = "force-dynamic";

export default async function PostDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCommunityUser();
  const { id } = await params;
  const blocked = await blockedIdsOf(user.id);
  const notBlocked = blocked.length ? { notIn: blocked } : undefined;
  const post = await prisma.post.findFirst({
    where: { id, churchId: user.churchId, authorId: notBlocked },
    include: {
      author: { select: { id: true, name: true } },
      photos: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true } },
      comments: { where: { authorId: notBlocked }, orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true } } } },
    },
  });
  if (!post) notFound();
  return (
    <div className="space-y-4">
      <Link href="/community?view=album" replace className="text-sm text-ink-3">
        ← 앨범으로
      </Link>
      <PostCard post={post} meId={user.id} canModerate={isModerator(user)} canPin={isStaff(user.role)} />
    </div>
  );
}
