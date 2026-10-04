import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { ROLES } from "@/lib/constants";
import { visibleSections } from "@/components/nav-config";
import { communityEnabled } from "@/lib/native-app";
import { ThemeToggle } from "@/components/nav";
import { IconBook, IconChevronRight, IconLogout, IconSettings, IconUser } from "@/components/icons";

export const metadata = { title: "전체 메뉴" };

/** 휴대폰 아래 탭의 '전체'. 탭에 다 못 담은 메뉴와 계정 관련 기능을 모은다. */
export default async function MorePage() {
  const user = await requireStaff();
  const church = await getChurch(user.churchId);
  const sections = visibleSections(user.role, { community: await communityEnabled(user.churchId) });

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-3 text-lg font-bold text-ink-2">
          {user.name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[1.05rem] font-bold text-ink">{user.name}</p>
          <p className="text-sm text-ink-3">
            {church.name} · {ROLES[user.role]}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <p className="eyebrow mb-2 px-1">{section.title}</p>
            <div className="card divide-y divide-line overflow-hidden">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="row-link">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-primary">
                      <Icon width={19} height={19} />
                    </span>
                    <span className="flex-1 font-semibold text-ink">{item.label}</span>
                    <IconChevronRight width={16} height={16} className="text-ink-3" />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        <section>
          <p className="eyebrow mb-2 px-1">계정</p>
          <div className="card divide-y divide-line overflow-hidden">
            <Link href="/my" className="row-link">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-primary">
                <IconUser width={19} height={19} />
              </span>
              <span className="flex-1 font-semibold text-ink">내 헌금·영수증 (성도 화면)</span>
              <IconChevronRight width={16} height={16} className="text-ink-3" />
            </Link>
            <Link href="/my/account" className="row-link">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-primary">
                <IconSettings width={19} height={19} />
              </span>
              <span className="flex-1 font-semibold text-ink">내 정보 · 계정 삭제</span>
              <IconChevronRight width={16} height={16} className="text-ink-3" />
            </Link>
            <Link href="/privacy" className="row-link">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-primary">
                <IconBook width={19} height={19} />
              </span>
              <span className="flex-1 font-semibold text-ink">개인정보처리방침 · 고객지원</span>
              <IconChevronRight width={16} height={16} className="text-ink-3" />
            </Link>
            <div className="row-link">
              <span className="flex-1 pl-12 font-semibold text-ink">화면 밝기 (밝게 / 어둡게)</span>
              <ThemeToggle />
            </div>
            <form action="/api/logout" method="post">
              <button type="submit" className="row-link w-full text-left">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-expense">
                  <IconLogout width={19} height={19} />
                </span>
                <span className="flex-1 font-semibold text-expense">로그아웃</span>
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
