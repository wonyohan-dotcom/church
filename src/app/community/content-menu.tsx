import Link from "next/link";
import { IconMore } from "@/components/icons";
import { REPORT_REASONS } from "@/lib/community";
import { blockUser, reportContent, togglePin } from "./actions";

/**
 * 글·댓글 옆의 ⋯ 메뉴. 내 글이면 삭제, 남의 글이면 신고·차단, 관리자는 삭제도 할 수 있다.
 * 열고 닫는 것은 브라우저 기본 기능(details)이라 스크립트가 필요 없다.
 */
export function ContentMenu({
  kind,
  targetId,
  authorId,
  meId,
  canModerate,
  deleteAction,
  pin,
  historyHref,
}: {
  kind: "POST" | "COMMENT";
  targetId: string;
  authorId: string;
  meId: string;
  canModerate: boolean;
  deleteAction: (formData: FormData) => Promise<void>;
  /** 교역자·관리자에게만 넘긴다: 공지 고정/해제 */
  pin?: { pinned: boolean };
  /** 교역자·관리자에게만 넘긴다: 이 글을 연혁에 올리는 화면 */
  historyHref?: string;
}) {
  const mine = authorId === meId;
  return (
    <details className="relative">
      <summary
        className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 [&::-webkit-details-marker]:hidden"
        aria-label="더 보기"
      >
        <IconMore width={18} height={18} />
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-52 rounded-2xl border border-line bg-surface p-2 text-sm shadow-[var(--shadow-sm)]">
        {historyHref && (
          <Link href={historyHref} className="block w-full rounded-lg px-3 py-2 text-left font-semibold text-ink hover:bg-surface-2">
            연혁에 올리기
          </Link>
        )}
        {pin && (
          <form action={togglePin}>
            <input type="hidden" name="id" value={targetId} />
            <button type="submit" className="w-full rounded-lg px-3 py-2 text-left font-semibold text-ink hover:bg-surface-2">
              {pin.pinned ? "공지 해제" : "공지로 고정"}
            </button>
          </form>
        )}
        {(mine || canModerate) && (
          <form action={deleteAction}>
            <input type="hidden" name="id" value={targetId} />
            <button type="submit" className="w-full rounded-lg px-3 py-2 text-left font-semibold text-expense hover:bg-surface-2">
              삭제
            </button>
          </form>
        )}
        {!mine && (
          <>
            <form action={reportContent} className="space-y-1.5 border-t border-line px-1 pt-2 first:border-0 first:pt-0">
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="targetId" value={targetId} />
              <select name="reason" className="field w-full py-1.5 text-xs" defaultValue="부적절한 내용">
                {REPORT_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <button type="submit" className="w-full rounded-lg px-2 py-1.5 text-left font-semibold text-ink hover:bg-surface-2">
                신고하기
              </button>
            </form>
            <form action={blockUser} className="mt-1 border-t border-line pt-1">
              <input type="hidden" name="userId" value={authorId} />
              <button type="submit" className="w-full rounded-lg px-3 py-2 text-left font-semibold text-ink hover:bg-surface-2">
                이 사람 차단
              </button>
            </form>
          </>
        )}
      </div>
    </details>
  );
}
