import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { MAX_POST_PHOTOS } from "@/lib/community-limits";
import { ymd } from "@/lib/format";
import { Alert, PageHeader } from "@/components/ui";
import { historyToPost } from "@/app/community/actions";

export const metadata = { title: "교회 소통에 공유" };
export const dynamic = "force-dynamic";

export default async function ShareHistory({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const { error } = await searchParams;
  const event = await prisma.historyEvent.findFirst({
    where: { id, churchId: staff.churchId },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
  });
  if (!event) notFound();
  const body = `${event.title} (${ymd(event.date)})${event.content ? `\n${event.content.slice(0, 600)}` : ""}`;

  return (
    <>
      <PageHeader
        title="교회 소통에 공유"
        description={`‘${event.title}’ 연혁을 성도들이 보는 사진·소식에 올립니다. 사진은 최대 ${MAX_POST_PHOTOS}장, 복사해서 올라갑니다.`}
        back={{ href: `/history/${event.id}`, label: "연혁 상세" }}
      />
      {error && (
        <div className="mb-4">
          <Alert tone="expense">글이나 사진 중 하나는 넣어 주세요.</Alert>
        </div>
      )}
      <form action={historyToPost} className="mx-auto max-w-xl space-y-4">
        <input type="hidden" name="eventId" value={event.id} />
        {event.photos.length > 0 && (
          <section className="card p-4">
            <h2 className="mb-3 text-[0.98rem] font-extrabold text-ink">올릴 사진 고르기 (최대 {MAX_POST_PHOTOS}장)</h2>
            <ul className="grid grid-cols-3 gap-2">
              {event.photos.map((ph, i) => (
                <li key={ph.id}>
                  <label className="relative block aspect-square cursor-pointer overflow-hidden rounded-xl bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt={ph.caption ?? ""} className="h-full w-full object-cover" />
                    <input type="checkbox" name="photoId" value={ph.id} defaultChecked={i < MAX_POST_PHOTOS} className="absolute right-1.5 top-1.5 h-5 w-5" />
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="card space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">올릴 글</span>
            <textarea name="body" rows={6} className="field w-full leading-relaxed" defaultValue={body} maxLength={1000} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" name="pinned" value="1" />
            공지로 올리기 <span className="text-xs text-ink-3">(사진 화면 맨 위에 고정)</span>
          </label>
          <button type="submit" className="btn btn-primary w-full">
            교회 소통에 올리기
          </button>
        </section>
      </form>
    </>
  );
}
