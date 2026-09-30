import {
  IconBank,
  IconBook,
  IconCalendarCheck,
  IconCare,
  IconHome,
  IconReceipt,
  IconSettings,
  IconUsers,
  IconWallet,
} from "./icons";
import type { Role } from "@/lib/constants";
import { FINANCE_ROLES, PASTORAL_ROLES } from "@/lib/constants";

/**
 * 관리 화면 메뉴 구성. 옆 메뉴(컴퓨터), 아래 탭·'전체' 화면(휴대폰)이 모두 이것을 쓴다.
 * 서버 화면에서도 읽을 수 있도록 "use client" 파일과 떼어 두었다.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  roles?: Role[];
};

export type NavSection = { title: string; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "교회",
    items: [
      { href: "/dashboard", label: "홈", icon: IconHome },
      { href: "/members", label: "교인", icon: IconUsers },
      { href: "/attendance", label: "출석", icon: IconCalendarCheck },
      { href: "/visits", label: "심방·상담", icon: IconCare, roles: PASTORAL_ROLES },
    ],
  },
  {
    title: "재정",
    items: [
      { href: "/finance", label: "회계", icon: IconWallet, roles: FINANCE_ROLES },
      { href: "/finance/bank", label: "입출금 알림", icon: IconBank, roles: FINANCE_ROLES },
      { href: "/receipts", label: "기부금영수증", icon: IconReceipt, roles: FINANCE_ROLES },
    ],
  },
  {
    title: "기록",
    items: [{ href: "/history", label: "교회 역사", icon: IconBook }],
  },
  {
    title: "관리",
    items: [{ href: "/settings", label: "설정", icon: IconSettings, roles: ["ADMIN"] }],
  },
];

export function visibleSections(role: Role): NavSection[] {
  return NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.roles || i.roles.includes(role)),
  })).filter((s) => s.items.length > 0);
}

