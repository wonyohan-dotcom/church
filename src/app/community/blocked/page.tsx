import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCommunityUser } from "@/lib/community";
import { EmptyState } from "@/components/ui";
import { unblockUser } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "차단한 사람" };

export default async function BlockedPage() {
  const user = await requireCommunityUser();
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { blocked: { select: { id: true, name: true } } },
  });
  return (
    <div className="space-y-4">
      <div>
        <Link href="/community" className="text-sm text-ink-3">
          ← 사진으로
        </Link>
        <h1 className="title mt-1 text-[1.35rem] text-ink">차단한 사람</h1>
        <p className="mt-1 text-sm text-ink-3">차단한 사람의 사진·댓글·채팅은 나에게 보이지 않습니다.</p>
      </div>
      {blocks.length === 0 ? (
        <EmptyState title="차단한 사람이 없습니다" />
      ) : (
        <ul className="card divide-y divide-line">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-semibold text-ink">{b.blocked.name}</span>
              <form action={unblockUser}>
                <input type="hidden" name="userId" value={b.blocked.id} />
                <button type="submit" className="btn btn-ghost btn-sm">
                  차단 해제
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
