import { requireStaff } from "@/lib/auth";
import { requireCommunityUser } from "@/lib/community";
import { SetlistForm } from "../setlist-form";

export const metadata = { title: "새 콘티" };

function nextSunday() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function NewSetlist({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff();
  await requireCommunityUser();
  const { error } = await searchParams;
  return <SetlistForm error={error} initial={{ title: "", date: nextSunday(), note: "", playlistUrl: "", songs: "" }} />;
}
