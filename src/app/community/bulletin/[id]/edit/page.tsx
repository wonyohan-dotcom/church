import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { requireCommunityUser } from "@/lib/community";
import { songsToText } from "@/lib/youtube";
import { BulletinForm } from "../../bulletin-form";

export const metadata = { title: "주보 고치기" };

const pad = (n: number) => String(n).padStart(2, "0");

export default async function EditBulletin({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireStaff();
  await requireCommunityUser();
  const { id } = await params;
  const { error } = await searchParams;
  const s = await prisma.setlist.findFirst({
    where: { id, churchId: user.churchId },
    include: { songs: { orderBy: { sortOrder: "asc" } } },
  });
  if (!s) notFound();
  const d = s.serviceDate;
  return (
    <div className="space-y-4">
      <h1 className="title text-[1.4rem] text-ink">주보 고치기</h1>
      <BulletinForm
        error={error}
        initial={{
          id: s.id,
          title: s.title,
          date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
          sermonTitle: s.sermonTitle ?? "",
          scripture: s.scripture ?? "",
          worshipOrder: s.worshipOrder ?? "",
          songs: songsToText(s.songs),
          playlistUrl: s.playlistUrl ?? "",
          announcements: s.announcements ?? "",
          prayers: s.prayers ?? "",
          note: s.note ?? "",
        }}
      />
    </div>
  );
}
