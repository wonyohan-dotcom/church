import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function Base({ children, ...p }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
      aria-hidden="true"
      {...p}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: P) => (
  <Base {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </Base>
);

export const IconUsers = (p: P) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5.3a3.2 3.2 0 0 1 0 6.2" />
    <path d="M17.6 14.2A6.5 6.5 0 0 1 21.5 20" />
  </Base>
);

export const IconWallet = (p: P) => (
  <Base {...p}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v1.5" />
    <rect x="3" y="7.5" width="18" height="12" rx="2.5" />
    <circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
  </Base>
);

export const IconReceipt = (p: P) => (
  <Base {...p}>
    <path d="M5 3.5h14v17l-2.3-1.6-2.4 1.6-2.3-1.6-2.4 1.6L7.3 19 5 20.5z" />
    <path d="M8.5 8.5h7M8.5 12.5h7M8.5 16h4" />
  </Base>
);

export const IconBook = (p: P) => (
  <Base {...p}>
    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 0 4 20.5z" />
    <path d="M4 18.5A1.5 1.5 0 0 1 5.5 17H19" />
    <path d="M8 7.5h7" />
  </Base>
);

export const IconSettings = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.76l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.76-.32 1.6 1.6 0 0 0-1 1.46V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9.1 19.4a1.6 1.6 0 0 0-1.76.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.83 15a1.6 1.6 0 0 0-1.46-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.46-1 1.6 1.6 0 0 0-.32-1.76l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.83a1.6 1.6 0 0 0 1-1.46V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.46 1.6 1.6 0 0 0 1.76-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.17 9a1.6 1.6 0 0 0 1.46 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.46 1z" />
  </Base>
);

export const IconUser = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Base>
);

export const IconPlus = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconSearch = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Base>
);

export const IconCamera = (p: P) => (
  <Base {...p}>
    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
    <circle cx="12" cy="12.5" r="3.4" />
  </Base>
);

export const IconPrint = (p: P) => (
  <Base {...p}>
    <path d="M7 9V3.5h10V9" />
    <path d="M5 9h14a2 2 0 0 1 2 2v5h-4v4.5H7V16H3v-5a2 2 0 0 1 2-2z" />
    <path d="M7 16h10" />
  </Base>
);

export const IconChevronRight = (p: P) => (
  <Base {...p}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </Base>
);

export const IconChevronLeft = (p: P) => (
  <Base {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Base>
);

export const IconCheck = (p: P) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Base>
);

export const IconX = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const IconClock = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);

export const IconLogout = (p: P) => (
  <Base {...p}>
    <path d="M14 7.5V5a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 4 5v14a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 14 19v-2.5" />
    <path d="M9.5 12H21m0 0-3.5-3.5M21 12l-3.5 3.5" />
  </Base>
);

export const IconMenu = (p: P) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

export const IconCross = (p: P) => (
  <Base {...p}>
    <path d="M12 3v18" />
    <path d="M6.5 8.5h11" />
  </Base>
);

export const IconTrend = (p: P) => (
  <Base {...p}>
    <path d="M3 17.5 9 11l4 4 8-8.5" />
    <path d="M15.5 6.5H21v5.5" />
  </Base>
);

export const IconDownload = (p: P) => (
  <Base {...p}>
    <path d="M12 3.5v11m0 0 4-4m-4 4-4-4" />
    <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
  </Base>
);
