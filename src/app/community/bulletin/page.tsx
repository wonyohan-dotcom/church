import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/auth";
import { requireCommunityUser } from "@/lib/community";
import { parseLines, parseOrder } from "@/lib/bulletin";
import { ymd } from "@/lib/format";
import { playerUrl, youtubeVideoId } from "@/lib/youtube";
import { EmptyState } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/form";
import { IconBook, IconHeart, IconMegaphone, IconMusic } from "@/components/icons";
import { deleteBulletin } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "주보" };

const DAY = ["일", "월", "화", "수", "목", "금", "토"];

function dday(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "오늘";
  if (diff > 0 && diff <= 14) return `D-${diff}`;
  return null;
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-soft text-primary">{icon}</span>
      <h2 className="text-[1.05rem] font-extrabold tracking-[-0.03em] text-ink">{children}</h2>
    </div>
  );
}

export default async function BulletinPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireCommunityUser();
  const { id } = await searchParams;
  const staff = isStaff(user.role);

  const all = await prisma.setlist.findMany({
    where: { churchId: user.churchId },
    orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }],
    take: 30,
    include: { songs: { orderBy: { sortOrder: "asc" } } },
  });

  // 지정한 주보가 없으면, 오늘 이후 가장 가까운 주보(없으면 가장 최근 것)를 보여 준다.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcoming = [...all].reverse().find((s) => s.serviceDate >= startOfToday);
  const current = all.find((s) => s.id === id) ?? upcoming ?? all[0];
  const others = all.filter((s) => s.id !== current?.id);

  return (
    <div className="space-y-4">
      {staff && (
        <Link href="/community/bulletin/new" className="btn btn-primary w-full">
          새 주보 올리기
        </Link>
      )}

      {!current ? (
        <EmptyState
          title="아직 올라온 주보가 없습니다"
          description={staff ? "위 버튼으로 이번 주 주보를 올려 주세요." : "교회에서 주보를 올리면 여기에 나타납니다."}
          icon={<IconBook width={22} height={22} />}
        />
      ) : (
        <Bulletin b={current} staff={staff} />
      )}

      {others.length > 0 && (
        <section className="pt-2">
          <h2 className="mb-2 px-1 text-sm font-extrabold text-ink">지난 주보</h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {others.map((s) => (
              <li key={s.id}>
                <Link href={`/community/bulletin?id=${s.id}`} replace className="row-link">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{s.sermonTitle || s.title}</span>
                    <span className="tnum block text-xs text-ink-3">
                      {ymd(s.serviceDate)} ({DAY[s.serviceDate.getDay()]})
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type Loaded = Awaited<ReturnType<typeof loadType>>[number];
// 타입 추출용 (호출되지 않는다)
async function loadType() {
  return prisma.setlist.findMany({ include: { songs: true } });
}

function Bulletin({ b, staff }: { b: Loaded; staff: boolean }) {
  const order = parseOrder(b.worshipOrder);
  const ads = parseLines(b.announcements);
  const prayers = parseLines(b.prayers);
  const embed = playerUrl(b.songs.map((s) => s.youtubeUrl), b.playlistUrl);
  const d = dday(b.serviceDate);

  return (
    <div className="space-y-4">
      {/* 표지 */}
      <section
        className="relative overflow-hidden rounded-[1.6rem] p-6 text-white"
        style={{ background: "linear-gradient(140deg, color-mix(in srgb, var(--primary) 62%, #07163f) 0%, var(--primary) 62%, color-mix(in srgb, var(--primary) 55%, #9cc3ff) 100%)" }}
      >
        <div aria-hidden className="absolute -right-10 -top-12 h-48 w-48 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-16 right-12 h-40 w-40 rounded-full bg-white/[0.07]" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[0.8rem] font-bold">
            <span className="tnum opacity-90">
              {ymd(b.serviceDate)} ({DAY[b.serviceDate.getDay()]})
            </span>
            {d && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs">{d}</span>}
          </div>
          <p className="mt-4 text-[0.85rem] font-semibold opacity-80">{b.title}</p>
          <h1 className="title mt-1 text-[1.75rem] leading-[1.25] tracking-[-0.045em]">
            {b.sermonTitle || "이번 주 예배"}
          </h1>
          {b.scripture && (
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-bold">
              <IconBook width={15} height={15} />
              {b.scripture}
            </p>
          )}
          {b.note && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed opacity-90">{b.note}</p>}
        </div>
      </section>

      {order.length > 0 && (
        <section className="card p-5">
          <SectionTitle icon={<IconBook width={17} height={17} />}>예배 순서</SectionTitle>
          <ol className="relative ml-[0.95rem] border-l-2 border-line">
            {order.map((step, i) => (
              <li key={i} className="relative flex items-baseline justify-between gap-4 py-2.5 pl-6">
                <span aria-hidden className="absolute -left-[0.4rem] top-[1.05rem] h-3 w-3 rounded-full border-[3px] border-surface bg-primary ring-1 ring-primary/30" />
                <span className="font-bold text-ink">{step.name}</span>
                {step.detail && <span className="shrink-0 text-right text-sm text-ink-3">{step.detail}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {(b.songs.length > 0 || embed) && (
        <section className="card overflow-hidden">
          <div className="p-5 pb-4">
            <SectionTitle icon={<IconMusic width={17} height={17} />}>찬양</SectionTitle>
            {embed && (
              <div className="-mx-1 aspect-video overflow-hidden rounded-2xl bg-black">
                <iframe
                  src={embed}
                  title={`${b.title} 찬양 재생목록`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            )}
          </div>
          {b.songs.length > 0 && (
            <ol className="divide-y divide-line border-t border-line">
              {b.songs.map((s, i) => {
                const vid = youtubeVideoId(s.youtubeUrl);
                return (
                  <li key={s.id} className="flex items-center gap-3.5 px-5 py-3.5">
                    <span className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[0.8rem] font-extrabold text-primary-soft-ink">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold text-ink">{s.title}</span>
                    {s.musicKey && <span className="shrink-0 rounded-lg bg-surface-2 px-2 py-1 text-xs font-bold text-ink-2">키 {s.musicKey}</span>}
                    {vid && (
                      <a href={`https://www.youtube.com/watch?v=${vid}`} className="btn btn-ghost btn-sm shrink-0">
                        유튜브
                      </a>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {ads.length > 0 && (
        <section className="card p-5">
          <SectionTitle icon={<IconMegaphone width={17} height={17} />}>광고</SectionTitle>
          <ol className="space-y-3">
            {ads.map((line, i) => (
              <li key={i} className="flex gap-3 text-[0.95rem] leading-relaxed text-ink">
                <span className="tnum mt-0.5 w-5 shrink-0 text-right font-extrabold text-primary">{i + 1}</span>
                <span className="min-w-0 break-words">{line}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {prayers.length > 0 && (
        <section className="rounded-[1.4rem] bg-primary-soft p-5">
          <SectionTitle icon={<IconHeart width={17} height={17} />}>
            <span className="text-primary-soft-ink">이번 주 기도 제목</span>
          </SectionTitle>
          <ul className="space-y-2.5">
            {prayers.map((line, i) => (
              <li key={i} className="flex gap-3 text-[0.95rem] leading-relaxed text-primary-soft-ink">
                <span aria-hidden className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0 break-words font-medium">{line}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {staff && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href={`/community/bulletin/new?from=${b.id}`} className="btn btn-ghost btn-sm">
            복사해서 새로 쓰기
          </Link>
          <Link href={`/community/bulletin/${b.id}/edit`} className="btn btn-ghost btn-sm">
            고치기
          </Link>
          <form action={deleteBulletin}>
            <input type="hidden" name="id" value={b.id} />
            <ConfirmSubmitButton message="이 주보를 삭제할까요?" className="btn btn-ghost btn-sm text-expense">
              삭제
            </ConfirmSubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
