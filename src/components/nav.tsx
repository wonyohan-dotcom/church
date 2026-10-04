"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./logo";
import {
  IconBook,
  IconCalendarCheck,
  IconGrid,
  IconHome,
  IconLogout,
  IconUsers,
  IconWallet,
} from "./icons";
import type { Role } from "@/lib/constants";
import { FINANCE_ROLES, ROLES } from "@/lib/constants";
import { visibleSections, type NavItem } from "./nav-config";

/** 여러 메뉴가 겹칠 때(/finance 와 /finance/bank) 가장 길게 맞는 하나만 켠다. */
function activeHref(pathname: string, hrefs: string[]) {
  let best: string | null = null;
  for (const href of hrefs) {
    const hit =
      href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname === href || pathname.startsWith(`${href}/`);
    if (hit && (!best || href.length > best.length)) best = href;
  }
  return best;
}

export function Sidebar({
  churchName,
  user,
  badges = {},
  community = true,
}: {
  churchName: string;
  user: { name: string; role: Role };
  /** 교회 소통 메뉴를 보일지 */
  community?: boolean;
  /** 메뉴 옆에 붙일 숫자 (예: 입출금 알림 대기 건수) */
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const sections = visibleSections(user.role, { community });
  const current = activeHref(pathname, sections.flatMap((s) => s.items.map((i) => i.href)));

  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-bg lg:flex">
      <Link href="/dashboard" className="flex items-center gap-3 px-6 pt-7 pb-6">
        <LogoMark size={38} decorative className="shrink-0" />
        <div className="min-w-0">
          <p className="title truncate text-[1.05rem] leading-tight text-ink">{churchName}</p>
          <p className="mt-0.5 text-[0.7rem] font-medium tracking-[0.02em] text-ink-3">
            심플한 교회관리
          </p>
        </div>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-4 pb-6">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="eyebrow mb-1.5 px-3">{section.title}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.href === current;
                const Icon = item.icon;
                const badge = badges[item.href] ?? 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-3 rounded-xl px-3 py-2 text-[0.9rem] font-semibold transition-colors ${
                      active ? "bg-primary-soft text-primary-soft-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    <Icon width={20} height={20} className={`shrink-0 ${active ? "text-primary" : "text-ink-3"}`} />
                    <span className="flex-1">{item.label}</span>
                    {badge > 0 && (
                      <span className="tnum rounded-full bg-primary px-1.5 py-px text-[0.68rem] font-bold text-primary-ink">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-4 py-4">
        <div className="flex items-center gap-3 px-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-sm font-bold text-ink-2">
            {user.name.slice(0, 1)}
          </span>
          <Link href="/my/account" className="min-w-0 flex-1 rounded-lg hover:opacity-80" title="내 정보 · 계정 삭제">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="text-[0.72rem] text-ink-3">{ROLES[user.role]} · 내 정보</p>
          </Link>
          <ThemeToggle />
          <form action="/api/logout" method="post">
            <button type="submit" className="btn btn-quiet btn-sm" title="로그아웃" aria-label="로그아웃">
              <IconLogout width={17} height={17} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function MobileTopBar({ churchName }: { churchName: string }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <LogoMark size={30} decorative className="shrink-0" />
          <span className="title truncate text-[1rem] text-ink">{churchName}</span>
        </Link>
      </div>
    </header>
  );
}

/** 휴대폰 아래 탭. 자주 쓰는 네 가지와 '전체' 로 묶는다. */
export function MobileTabBar({ role, badges = {} }: { role: Role; badges?: Record<string, number> }) {
  const pathname = usePathname();
  const tabs: NavItem[] = [
    { href: "/dashboard", label: "홈", icon: IconHome },
    { href: "/members", label: "교인", icon: IconUsers },
    { href: "/attendance", label: "출석", icon: IconCalendarCheck },
    FINANCE_ROLES.includes(role)
      ? { href: "/finance", label: "회계", icon: IconWallet }
      : { href: "/history", label: "역사", icon: IconBook },
    { href: "/more", label: "전체", icon: IconGrid },
  ];
  const allHrefs = visibleSections(role).flatMap((s) => s.items.map((i) => i.href));
  const current = activeHref(pathname, [...allHrefs, "/more"]);
  // 탭에 없는 화면(예: 기부금영수증)에 있을 때는 '전체' 탭을 켠다.
  const currentTab = tabs.some((t) => t.href === current) ? current : "/more";
  const moreBadge = Object.entries(badges)
    .filter(([href]) => !tabs.some((t) => t.href === href))
    .reduce((sum, [, n]) => sum + n, 0);

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {tabs.map((item) => {
        const active = item.href === currentTab;
        const Icon = item.icon;
        const badge = item.href === "/more" ? moreBadge : (badges[item.href] ?? 0);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[0.68rem] font-semibold transition-colors ${
              active ? "text-primary" : "text-ink-3"
            }`}
          >
            <span className="relative">
              <Icon width={24} height={24} />
              {badge > 0 && (
                <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-expense ring-2 ring-surface" />
              )}
            </span>
            {item.label}
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
