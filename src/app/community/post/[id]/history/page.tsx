import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { requireCommunityUser } from "@/lib/community";
import { HISTORY_CATEGORIES } from "@/lib/constants";
import { ymd, ymdDash } from "@/lib/format";
import { Alert } from "@/components/ui";
import { postToHistory } from "../../../actions";

export const metadata = { title: "연혁에 올리기" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = { input: "새 연혁은 제목과 날짜를 입력해 주세요.", event: "붙일 연혁을 골라 주세요." };

export default async function PostToHistory({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await requireStaff();
  await requireCommunityUser();
  const { id } = await params;
  const { error } = await searchParams;
  const post = await prisma.post.findFirst({
    where: { id, churchId: user.churchId },
    include: { photos: { orderBy: { sortOrder: "asc" } }, author: { select: { name: true } } },
  });
  if (!post) notFound();
  const events = await prisma.historyEvent.findMany({
    where: { churchId: user.churchId },
    orderBy: { date: "desc" },
    take: 60,
    select: { id: true, title: true, date: true },
  });
  const firstLine = post.body.split("\n")[0].slice(0, 60);

  return (
    <form action={postToHistory} className="space-y-4">
      <input type="hidden" name="postId" value={post.id} />
      <div>
        <Link href={`/community/post/${post.id}`} className="text-sm text-ink-3">
          ← 글로 돌아가기
        </Link>
        <h1 className="title mt-1 text-[1.35rem] text-ink">연혁에 올리기</h1>
        <p className="mt-1 text-sm text-ink-3">이 글의 사진과 내용을 교회 연혁에 남깁니다. 사진은 복사해서 올라가므로 서로 영향이 없습니다.</p>
      </div>
      {error && ERRORS[error] && <Alert tone="expense">{ERRORS[error]}</Alert>}

      {post.photos.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 text-[0.98rem] font-extrabold text-ink">올릴 사진 고르기</h2>
          <ul className="grid grid-cols-3 gap-2">
            {post.photos.map((ph) => (
              <li key={ph.id}>
                <label className="relative block aspect-square cursor-pointer overflow-hidden rounded-xl bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ph.url} alt="" className="h-full w-full object-cover" />
                  <input type="checkbox" name="photoId" value={ph.id} defaultChecked className="absolute right-1.5 top-1.5 h-5 w-5" />
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="text-[0.98rem] font-extrabold text-ink">새 연혁으로 올리기</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">제목</span>
          <input name="title" className="field w-full" defaultValue={firstLine} maxLength={100} placeholder="예) 가을 야외 예배" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">날짜</span>
            <input name="date" type="date" className="field w-full" defaultValue={ymdDash(post.createdAt)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">분류</span>
            <select name="category" className="field w-full" defaultValue="EVENT">
              {Object.entries(HISTORY_CATEGORIES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">내용</span>
          <textarea name="content" rows={4} className="field w-full" defaultValue={post.body} />
        </label>
        <button type="submit" name="mode" value="new" className="btn btn-primary w-full">
          새 연혁으로 올리기
        </button>
      </section>

      {events.length > 0 && (
        <section className="card space-y-3 p-4">
          <h2 className="text-[0.98rem] font-extrabold text-ink">이미 있는 연혁에 사진 붙이기</h2>
          <select name="eventId" className="field w-full" defaultValue="">
            <option value="" disabled>
              연혁을 골라 주세요
            </option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {ymd(e.date)} · {e.title}
              </option>
            ))}
          </select>
          <button type="submit" name="mode" value="existing" className="btn btn-ghost w-full">
            선택한 연혁에 사진 붙이기
          </button>
        </section>
      )}
    </form>
  );
}
