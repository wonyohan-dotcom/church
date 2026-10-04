import Link from "next/link";
import { communityEnabled } from "@/lib/native-app";
import { IconCamera, IconChat, IconMusic } from "./icons";

const TILES = [
  { href: "/community", label: "교회 사진", icon: IconCamera },
  { href: "/community/chat", label: "전체 채팅", icon: IconChat },
  { href: "/community/setlist", label: "이번 주 콘티", icon: IconMusic },
];

/** 홈 화면의 교회 소통 바로가기 (사진 · 채팅 · 콘티) */
export async function CommunityShortcuts({ className = "mb-5" }: { className?: string }) {
  if (!(await communityEnabled())) return null;
  return (
    <section className={className}>
      <p className="eyebrow mb-2 px-1">교회 소통</p>
      <div className="grid grid-cols-3 gap-2.5">
        {TILES.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="card flex flex-col items-center gap-2 px-2 py-4 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Icon width={20} height={20} />
            </span>
            <span className="text-[0.82rem] font-bold text-ink">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
