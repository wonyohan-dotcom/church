"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/community", label: "사진" },
  { href: "/community/bulletin", label: "주보" },
  { href: "/community/chat", label: "채팅" },
];

export function CommunityNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {ITEMS.map((item) => {
        const active = item.href === "/community" ? pathname === "/community" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            replace
            className={`flex-1 border-b-2 px-3 py-2.5 text-center text-sm font-semibold transition-colors ${
              active ? "border-primary text-primary" : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
