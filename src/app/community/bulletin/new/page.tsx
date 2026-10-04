import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { requireCommunityUser } from "@/lib/community";
import { songsToText } from "@/lib/youtube";
import { BulletinForm } from "../bulletin-form";

export const metadata = { title: "새 주보" };

const pad = (n: number) => String(n).padStart(2, "0");
const dateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function nextSunday() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return dateInput(d);
}

export default async function NewBulletin({ searchParams }: { searchParams: Promise<{ error?: string; from?: string }> }) {
  const user = await requireStaff();
  await requireCommunityUser();
  const { error, from } = await searchParams;

  // 지난 주보를 복사해서 시작할 수 있다. 날짜만 다음 주일로 바꾼다.
  const source = from
    ? await prisma.setlist.findFirst({ where: { id: from, churchId: user.churchId }, include: { songs: { orderBy: { sortOrder: "asc" } } } })
    : null;

  return (
    <div className="space-y-4">
      <h1 className="title text-[1.4rem] text-ink">새 주보</h1>
      <BulletinForm
        error={error}
        initial={{
          title: source?.title ?? "",
          date: nextSunday(),
          sermonTitle: "",
          scripture: "",
          worshipOrder: source?.worshipOrder ?? "",
          songs: source ? songsToText(source.songs) : "",
          playlistUrl: "",
          announcements: "",
          prayers: "",
          note: "",
        }}
      />
    </div>
  );
}
