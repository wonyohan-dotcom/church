import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { isStaff } from "@/lib/auth";
import { IconLogout } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/nav";
import { MyNav } from "./my-nav";

export default async function MyLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const church = await getChurch(user.churchId);

  return (
    <div className="min-h-dvh bg-bg">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/my" className="flex min-w-0 items-center gap-2.5">
            <LogoMark size={36} decorative className="shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-[0.95rem] font-bold leading-tight text-ink">
                {church.name}
              </span>
              <span className="block text-[0.7rem] text-ink-3">성도 서비스</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {isStaff(user.role) && (
              <Link href="/dashboard" className="btn btn-quiet btn-sm">
                관리
              </Link>
            )}
            <form action="/api/logout" method="post">
              <button type="submit" className="btn btn-quiet btn-sm" aria-label="로그아웃">
                <IconLogout width={18} height={18} />
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4">
          <MyNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16">{children}</main>
    </div>
  );
}
