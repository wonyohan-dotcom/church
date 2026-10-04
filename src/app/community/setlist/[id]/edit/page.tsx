import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { requireCommunityUser } from "@/lib/community";
import { songsToText } from "@/lib/youtube";
import { SetlistForm } from "../../setlist-form";

export const metadata = { title: "콘티 고치기" };

export default async function EditSetlist({
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
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return (
    <SetlistForm
      error={error}
      initial={{ id: s.id, title: s.title, date, note: s.note ?? "", playlistUrl: s.playlistUrl ?? "", songs: songsToText(s.songs) }}
    />
  );
}
