import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isModerator, requireCommunityUser, timeAgo } from "@/lib/community";
import { ConfirmSubmitButton } from "@/components/form";
import { EmptyState } from "@/components/ui";
import { removeReported, resolveReport } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "신고 확인" };

const KIND: Record<string, string> = { POST: "사진 글", COMMENT: "댓글", CHAT: "채팅" };

export default async function ReportsPage() {
  const user = await requireCommunityUser();
  if (!isModerator(user)) redirect("/community");

  const reports = await prisma.contentReport.findMany({
    where: { churchId: user.churchId, resolved: false },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { reporter: { select: { name: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <Link href="/community" className="text-sm text-ink-3">
          ← 사진으로
        </Link>
        <h1 className="title mt-1 text-[1.35rem] text-ink">신고 확인</h1>
        <p className="mt-1 text-sm text-ink-3">신고된 글을 확인해 지우거나, 문제가 없으면 처리 완료로 표시해 주세요.</p>
      </div>

      {reports.length === 0 ? (
        <EmptyState title="처리할 신고가 없습니다" />
      ) : (
        reports.map((r) => (
          <article key={r.id} className="card p-4">
            <p className="text-xs text-ink-3">
              {KIND[r.kind] ?? r.kind} · {r.reporter.name} 님 신고 · {timeAgo(r.createdAt)}
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">사유: {r.reason}</p>
            {r.excerpt && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-ink-2">{r.excerpt}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <form action={resolveReport}>
                <input type="hidden" name="id" value={r.id} />
                <button type="submit" className="btn btn-ghost btn-sm">
                  문제 없음
                </button>
              </form>
              <form action={removeReported}>
                <input type="hidden" name="id" value={r.id} />
                <ConfirmSubmitButton message="이 글을 지울까요?" className="btn btn-danger btn-sm">
                  글 삭제
                </ConfirmSubmitButton>
              </form>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
