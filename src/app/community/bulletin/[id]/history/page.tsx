import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { requireCommunityUser } from "@/lib/community";
import { parseLines, parseOrder } from "@/lib/bulletin";
import { HISTORY_CATEGORIES } from "@/lib/constants";
import { ymdDash } from "@/lib/format";
import { Alert } from "@/components/ui";
import { bulletinToHistory } from "../../../actions";

export const metadata = { title: "주보를 연혁으로" };
export const dynamic = "force-dynamic";

export default async function BulletinToHistory({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await requireStaff();
  await requireCommunityUser();
  const { id } = await params;
  const { error } = await searchParams;
  const b = await prisma.setlist.findFirst({ where: { id, churchId: user.churchId }, include: { songs: { orderBy: { sortOrder: "asc" } } } });
  if (!b) notFound();

  // 주보 내용을 연혁 글로 미리 정리해 둔다. 고쳐서 올릴 수 있다.
  const lines: string[] = [];
  if (b.sermonTitle) lines.push(`설교: ${b.sermonTitle}${b.scripture ? ` (${b.scripture})` : ""}`);
  const order = parseOrder(b.worshipOrder);
  if (order.length) lines.push(`예배 순서: ${order.map((s) => (s.detail ? `${s.name}(${s.detail})` : s.name)).join(" · ")}`);
  if (b.songs.length) lines.push(`찬양: ${b.songs.map((s) => s.title).join(", ")}`);
  const ads = parseLines(b.announcements);
  if (ads.length) lines.push(`광고: ${ads.join(" / ")}`);
  const prayers = parseLines(b.prayers);
  if (prayers.length) lines.push(`기도 제목: ${prayers.join(" / ")}`);
  if (b.note) lines.push(b.note);

  return (
    <form action={bulletinToHistory} className="space-y-4">
      <input type="hidden" name="bulletinId" value={b.id} />
      <div>
        <Link href={`/community/bulletin?id=${b.id}`} className="text-sm text-ink-3">
          ← 주보로 돌아가기
        </Link>
        <h1 className="title mt-1 text-[1.35rem] text-ink">주보를 연혁으로 기록</h1>
        <p className="mt-1 text-sm text-ink-3">이날의 예배 내용을 교회 연혁에 남깁니다. 내용은 고쳐서 올릴 수 있습니다.</p>
      </div>
      {error && <Alert tone="expense">제목과 날짜를 입력해 주세요.</Alert>}
      <section className="card space-y-3 p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">제목</span>
          <input name="title" className="field w-full" maxLength={100} defaultValue={`${b.sermonTitle ? `${b.sermonTitle} — ` : ""}${b.title}`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">날짜</span>
            <input name="date" type="date" className="field w-full" defaultValue={ymdDash(b.serviceDate)} />
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
          <textarea name="content" rows={9} className="field w-full leading-relaxed" defaultValue={lines.join("\n")} />
        </label>
        <button type="submit" className="btn btn-primary w-full">
          연혁으로 기록하기
        </button>
      </section>
    </form>
  );
}
