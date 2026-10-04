import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/auth";
import { requireCommunityUser } from "@/lib/community";
import { ymd } from "@/lib/format";
import { playerUrl, youtubeVideoId } from "@/lib/youtube";
import { EmptyState } from "@/components/ui";
import { IconMusic } from "@/components/icons";
import { ConfirmSubmitButton } from "@/components/form";
import { deleteSetlist } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "이번 주 콘티" };

export default async function SetlistPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireCommunityUser();
  const { id } = await searchParams;
  const staff = isStaff(user.role);

  const all = await prisma.setlist.findMany({
    where: { churchId: user.churchId },
    orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }],
    take: 30,
    include: { songs: { orderBy: { sortOrder: "asc" } } },
  });

  // 지정한 콘티가 없으면, 오늘 이후 가장 가까운 콘티(없으면 가장 최근 것)를 보여 준다.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcoming = [...all].reverse().find((s) => s.serviceDate >= startOfToday);
  const current = all.find((s) => s.id === id) ?? upcoming ?? all[0];
  const others = all.filter((s) => s.id !== current?.id);

  const embed = current ? playerUrl(current.songs.map((s) => s.youtubeUrl), current.playlistUrl) : null;

  return (
    <div className="space-y-5">
      {staff && (
        <Link href="/community/setlist/new" className="btn btn-primary w-full">
          새 콘티 올리기
        </Link>
      )}

      {!current ? (
        <EmptyState
          title="아직 올라온 콘티가 없습니다"
          description={staff ? "위 버튼으로 이번 주 콘티를 올려 주세요." : "교회에서 이번 주 콘티를 올리면 여기에 나타납니다."}
          icon={<IconMusic width={22} height={22} />}
        />
      ) : (
        <section className="card overflow-hidden">
          <div className="p-5 pb-3">
            <p className="text-xs font-semibold text-primary">{ymd(current.serviceDate)}</p>
            <h1 className="title mt-0.5 text-[1.35rem] text-ink">{current.title}</h1>
            {current.note && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{current.note}</p>}
          </div>

          {embed && (
            <div className="aspect-video w-full bg-black">
              <iframe
                src={embed}
                title={`${current.title} 재생목록`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          )}

          {current.songs.length > 0 && (
            <ol className="divide-y divide-line">
              {current.songs.map((s, i) => {
                const vid = youtubeVideoId(s.youtubeUrl);
                return (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="tnum w-5 shrink-0 text-center text-sm font-bold text-ink-3">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{s.title}</p>
                      {s.musicKey && <p className="text-xs text-ink-3">키 {s.musicKey}</p>}
                    </div>
                    {vid && (
                      <a
                        href={`https://www.youtube.com/watch?v=${vid}`}
                        className="btn btn-ghost btn-sm shrink-0"
                      >
                        유튜브
                      </a>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {staff && (
            <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
              <Link href={`/community/setlist/${current.id}/edit`} className="btn btn-ghost btn-sm">
                고치기
              </Link>
              <form action={deleteSetlist}>
                <input type="hidden" name="id" value={current.id} />
                <ConfirmSubmitButton message="이 콘티를 삭제할까요?" className="btn btn-ghost btn-sm text-expense">
                  삭제
                </ConfirmSubmitButton>
              </form>
            </div>
          )}
        </section>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-sm font-bold text-ink">지난 콘티</h2>
          <ul className="card divide-y divide-line">
            {others.map((s) => (
              <li key={s.id}>
                <Link href={`/community/setlist?id=${s.id}`} replace className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <span className="min-w-0 truncate font-semibold text-ink">{s.title}</span>
                  <span className="tnum shrink-0 text-xs text-ink-3">{ymd(s.serviceDate)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
