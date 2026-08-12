"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/my", label: "홈" },
  { href: "/my/offerings", label: "헌금 내역" },
  { href: "/my/receipts", label: "기부금영수증" },
];

export function MyNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {ITEMS.map((item) => {
        const active =
          item.href === "/my" ? pathname === "/my" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
