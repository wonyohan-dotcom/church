"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBook,
  IconCross,
  IconHome,
  IconLogout,
  IconReceipt,
  IconSettings,
  IconUser,
  IconUsers,
  IconWallet,
} from "./icons";
import type { Role } from "@/lib/constants";
import { ROLES } from "@/lib/constants";

type NavItem = {
  href: string;
  label: string;
  icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  roles?: Role[];
};

const STAFF_NAV: NavItem[] = [
  { href: "/dashboard", label: "대시보드", icon: IconHome },
  { href: "/members", label: "교적 관리", icon: IconUsers },
  { href: "/finance", label: "회계 관리", icon: IconWallet },
  { href: "/receipts", label: "기부금영수증", icon: IconReceipt },
  { href: "/history", label: "교회 역사", icon: IconBook },
  { href: "/settings", label: "설정", icon: IconSettings, roles: ["ADMIN"] },
];

/** 모바일 하단 탭 (5개까지) */
const MOBILE_NAV = STAFF_NAV.slice(0, 5);

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  churchName,
  user,
}: {
  churchName: string;
  user: { name: string; role: Role };
}) {
  const pathname = usePathname();
  const items = STAFF_NAV.filter((i) => !i.roles || i.roles.includes(user.role));

  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-ink">
          <IconCross width={18} height={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.95rem] font-bold leading-tight tracking-[-0.01em] text-ink">
            {churchName}
          </p>
          <p className="text-[0.7rem] font-medium text-ink-3">통합 관리 시스템</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9rem] font-semibold transition-colors ${
                active
                  ? "bg-primary-soft text-primary-soft-ink"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon className="shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-2">
            <IconUser width={16} height={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="text-[0.7rem] text-ink-3">{ROLES[user.role]}</p>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <ThemeToggle />
          <form action="/api/logout" method="post" className="flex-1">
            <button
              type="submit"
              className="btn btn-quiet btn-sm w-full justify-start"
              title="로그아웃"
            >
              <IconLogout width={16} height={16} />
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function MobileTopBar({ churchName }: { churchName: string }) {
  return (
    <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
      <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-ink">
          <IconCross width={16} height={16} />
        </span>
        <span className="truncate text-[0.95rem] font-bold tracking-[-0.01em] text-ink">
          {churchName}
        </span>
      </Link>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Link href="/settings" className="btn btn-quiet btn-sm" aria-label="설정">
          <IconSettings width={18} height={18} />
        </Link>
        <form action="/api/logout" method="post">
          <button type="submit" className="btn btn-quiet btn-sm" aria-label="로그아웃">
            <IconLogout width={18} height={18} />
          </button>
        </form>
      </div>
    </header>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {MOBILE_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 py-2.5 text-[0.65rem] font-semibold transition-colors ${
              active ? "text-primary" : "text-ink-3"
            }`}
          >
            <Icon width={21} height={21} />
            {item.label.replace(" 관리", "")}
          </Link>
        );
      })}
    </nav>
  );
}

/* ── 라이트/다크 전환 ───────────────────── */

export function ThemeToggle() {
  // 현재 테마는 <html data-theme>에 이미 들어 있다(레이아웃의 초기화 스크립트).
  // 별도 상태를 두면 서버 렌더 결과와 어긋나므로 누를 때 DOM에서 직접 읽는다.
  function toggle() {
    const root = document.documentElement;
    const current =
      root.getAttribute("data-theme") ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("church-theme", next);
    } catch {
      // 사생활 보호 모드 등으로 저장이 막혀 있어도 화면 전환은 되도록 둔다.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-quiet btn-sm"
      aria-label="화면 밝기 전환"
      title="화면 밝기 전환"
    >
      <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
      </svg>
    </button>
  );
}
