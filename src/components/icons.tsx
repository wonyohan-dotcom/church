import type { SVGProps } from "react";

/**
 * 앱 안에서 쓰는 그림 아이콘.
 * 둥글고 꽉 찬 모양(채운 아이콘)을 기본으로 하고, 보조 부분은 반투명으로 두어 입체감을 준다.
 * 화살표·검색·닫기처럼 글자에 가까운 것만 굵은 선으로 그린다.
 * 색은 모두 currentColor 라 글자색을 따라간다. 앱 아이콘(SC 로고)은 logo.tsx 에 따로 있다.
 */

type P = SVGProps<SVGSVGElement>;

/** 채운 아이콘 */
function Solid({ children, ...p }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={20} height={20} aria-hidden="true" {...p}>
      {children}
    </svg>
  );
}

/** 굵은 선 아이콘 (화살표·검색·닫기 등) */
function Line({ children, strokeWidth = 2.2, ...p }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
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

const soft = { opacity: 0.4 } as const;

export const IconHome = (p: P) => (
  <Solid {...p}>
    <path d="M11 2.9a1.6 1.6 0 0 1 2 0l8 6.6c.4.3.6.8.6 1.2V19a2.5 2.5 0 0 1-2.5 2.5h-3.6a.9.9 0 0 1-.9-.9v-4.2a2.6 2.6 0 0 0-5.2 0v4.2a.9.9 0 0 1-.9.9H4.9A2.5 2.5 0 0 1 2.4 19v-8.3c0-.4.2-.9.6-1.2z" />
  </Solid>
);

export const IconUsers = (p: P) => (
  <Solid {...p}>
    <circle cx="9" cy="7.5" r="3.6" />
    <path d="M2.3 19.6a6.7 6.7 0 0 1 13.4 0c0 .8-.6 1.4-1.4 1.4H3.7c-.8 0-1.4-.6-1.4-1.4z" />
    <circle cx="17" cy="8.6" r="2.8" style={soft} />
    <path d="M15 14.2a5.6 5.6 0 0 1 7 5.3c0 .8-.6 1.5-1.4 1.5h-3.3c.2-2.5-.7-4.9-2.3-6.8z" style={soft} />
  </Solid>
);

export const IconWallet = (p: P) => (
  <Solid {...p}>
    <path d="M6 3.2h10.5a2.3 2.3 0 0 1 2.3 2.3H3.7A2.3 2.3 0 0 1 6 3.2z" style={soft} />
    <path
      fillRule="evenodd"
      d="M5.2 6.3h13.6A3.2 3.2 0 0 1 22 9.5v8.3a3.2 3.2 0 0 1-3.2 3.2H5.2A3.2 3.2 0 0 1 2 17.8V9.5a3.2 3.2 0 0 1 3.2-3.2zm11.3 5.2a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z"
    />
  </Solid>
);

export const IconReceipt = (p: P) => (
  <Solid {...p}>
    <path
      fillRule="evenodd"
      d="M6.2 2.3h11.6c.8 0 1.5.7 1.5 1.5v16.6c0 .7-.8 1.1-1.4.7l-1.8-1.3-2.1 1.5a.9.9 0 0 1-1 0L12 20l-1 .7a.9.9 0 0 1-1 0L7.9 19.8l-1.8 1.3c-.6.4-1.4 0-1.4-.7V3.8c0-.8.7-1.5 1.5-1.5zM8 7.3v1.8h8V7.3zm0 4v1.8h8v-1.8zm0 4v1.8h5v-1.8z"
    />
  </Solid>
);

export const IconBook = (p: P) => (
  <Solid {...p}>
    <path
      fillRule="evenodd"
      d="M6.8 2.4h11.7c.8 0 1.5.7 1.5 1.5v15.7c0 .8-.7 1.5-1.5 1.5H6.8a3 3 0 0 1-3-3V5.4a3 3 0 0 1 3-3zm0 14.4a1.3 1.3 0 0 0 0 2.6H18v-2.6zM8 6.6v1.8h8V6.6z"
    />
  </Solid>
);

export const IconSettings = (p: P) => (
  <Solid {...p}>
    <path
      fillRule="evenodd"
      d="M10.2 2.4h3.6c.4 0 .8.3.9.7l.4 2a7.9 7.9 0 0 1 1.8 1l1.9-.7c.4-.1.8 0 1 .4l1.8 3.1c.2.4.1.8-.2 1.1l-1.5 1.3a8 8 0 0 1 0 2.1l1.5 1.3c.3.3.4.7.2 1.1l-1.8 3.1c-.2.4-.6.5-1 .4l-1.9-.7a7.9 7.9 0 0 1-1.8 1l-.4 2c-.1.4-.5.7-.9.7h-3.6c-.4 0-.8-.3-.9-.7l-.4-2a7.9 7.9 0 0 1-1.8-1l-1.9.7c-.4.1-.8 0-1-.4L2.4 15.8c-.2-.4-.1-.8.2-1.1l1.5-1.3a8 8 0 0 1 0-2.1L2.6 10c-.3-.3-.4-.7-.2-1.1l1.8-3.1c.2-.4.6-.5 1-.4l1.9.7a7.9 7.9 0 0 1 1.8-1l.4-2c.1-.4.5-.7.9-.7zM12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z"
    />
  </Solid>
);

export const IconUser = (p: P) => (
  <Solid {...p}>
    <circle cx="12" cy="7.6" r="4.2" />
    <path d="M3.6 20a8.4 8.4 0 0 1 16.8 0c0 .8-.6 1.4-1.4 1.4H5a1.4 1.4 0 0 1-1.4-1.4z" />
  </Solid>
);

export const IconPlus = (p: P) => (
  <Line {...p}>
    <path d="M12 5v14M5 12h14" />
  </Line>
);

export const IconSearch = (p: P) => (
  <Line {...p}>
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="m15.6 15.6 4.4 4.4" />
  </Line>
);

export const IconCamera = (p: P) => (
  <Solid {...p}>
    <path
      fillRule="evenodd"
      d="M8.6 3.3h6.8c.5 0 .9.2 1.2.6l1.3 1.9H20a2.8 2.8 0 0 1 2.8 2.8v9.2A2.8 2.8 0 0 1 20 20.6H4a2.8 2.8 0 0 1-2.8-2.8V8.6A2.8 2.8 0 0 1 4 5.8h2.1l1.3-1.9c.3-.4.7-.6 1.2-.6zM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"
    />
  </Solid>
);

export const IconPrint = (p: P) => (
  <Solid {...p}>
    <path d="M6.5 2.6h11v5.2h-11z" style={soft} />
    <path
      fillRule="evenodd"
      d="M4.5 9h15A2.5 2.5 0 0 1 22 11.5v5.3c0 .7-.6 1.2-1.2 1.2H18V21a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-3H3.2A1.2 1.2 0 0 1 2 16.8v-5.3A2.5 2.5 0 0 1 4.5 9zm3.3 6v4.4h8.4V15z"
    />
  </Solid>
);

export const IconChevronRight = (p: P) => (
  <Line {...p}>
    <path d="m9 5 7 7-7 7" />
  </Line>
);

export const IconChevronLeft = (p: P) => (
  <Line {...p}>
    <path d="m15 5-7 7 7 7" />
  </Line>
);

export const IconCheck = (p: P) => (
  <Line strokeWidth={2.6} {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Line>
);

export const IconX = (p: P) => (
  <Line {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Line>
);

export const IconClock = (p: P) => (
  <Solid {...p}>
    <path fillRule="evenodd" d="M12 2.2a9.8 9.8 0 1 1 0 19.6 9.8 9.8 0 0 1 0-19.6zM11 7v5.5c0 .3.2.6.4.8l3.4 2 1-1.6-2.8-1.7V7z" />
  </Solid>
);

export const IconLogout = (p: P) => (
  <Line {...p}>
    <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
    <path d="m15.5 8 4 4-4 4M19 12H9.5" />
  </Line>
);

export const IconMenu = (p: P) => (
  <Line {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Line>
);

export const IconCross = (p: P) => (
  <Solid {...p}>
    <path d="M10 2.4h4a.6.6 0 0 1 .6.6v5.4H20a.6.6 0 0 1 .6.6v4a.6.6 0 0 1-.6.6h-5.4V21a.6.6 0 0 1-.6.6h-4a.6.6 0 0 1-.6-.6v-7.4H4a.6.6 0 0 1-.6-.6V9a.6.6 0 0 1 .6-.6h5.4V3a.6.6 0 0 1 .6-.6z" />
  </Solid>
);

export const IconTrend = (p: P) => (
  <Line {...p}>
    <path d="M3.5 16.5 9 11l4 4 7.5-7.5" />
    <path d="M14.5 7.5h6v6" />
  </Line>
);

export const IconDownload = (p: P) => (
  <Line {...p}>
    <path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15" />
  </Line>
);

export const IconCalendarCheck = (p: P) => (
  <Solid {...p}>
    <path
      fillRule="evenodd"
      d="M7.2 2.2h2v2.2h5.6V2.2h2v2.2h1.4A2.8 2.8 0 0 1 21 7.2v11.6a2.8 2.8 0 0 1-2.8 2.8H5.8A2.8 2.8 0 0 1 3 18.8V7.2a2.8 2.8 0 0 1 2.8-2.8h1.4zM5 9.4v9.4a.8.8 0 0 0 .8.8h12.4a.8.8 0 0 0 .8-.8V9.4zm5.8 7.7-2.9-2.9 1.4-1.4 1.5 1.5 3.9-3.9 1.4 1.4z"
    />
  </Solid>
);

export const IconCare = (p: P) => (
  <Solid {...p}>
    <path d="M12 21.2c-.3 0-.6-.1-.8-.3C7.6 18.5 2.4 14.4 2.4 9.3A5.1 5.1 0 0 1 7.5 4.2c1.8 0 3.4.9 4.5 2.4a5.4 5.4 0 0 1 4.5-2.4 5.1 5.1 0 0 1 5.1 5.1c0 5.1-5.2 9.2-8.8 11.6-.2.2-.5.3-.8.3z" />
    <path d="M7.3 7.2a2.3 2.3 0 0 0-2.3 2.3" style={{ opacity: 0.35 }} stroke="#fff" strokeWidth={1.4} strokeLinecap="round" fill="none" />
  </Solid>
);

export const IconBank = (p: P) => (
  <Solid {...p}>
    <path d="M11.4 2.5a1.4 1.4 0 0 1 1.2 0l8.3 4.2c.7.3.5 1.4-.3 1.4H3.4c-.8 0-1-1.1-.3-1.4z" />
    <path d="M4 10h2.6v7H4zM9.2 10h2.6v7H9.2zM14.2 10h2.6v7h-2.6zM19.4 10H22v7h-2.6z" style={soft} />
    <path d="M3.2 18.6h17.6c.7 0 1.2.5 1.2 1.2v.6c0 .7-.5 1.2-1.2 1.2H3.2c-.7 0-1.2-.5-1.2-1.2v-.6c0-.7.5-1.2 1.2-1.2z" />
  </Solid>
);

export const IconGrid = (p: P) => (
  <Solid {...p}>
    <rect x="3" y="3" width="7.6" height="7.6" rx="2.2" />
    <rect x="13.4" y="3" width="7.6" height="7.6" rx="2.2" style={soft} />
    <rect x="3" y="13.4" width="7.6" height="7.6" rx="2.2" style={soft} />
    <rect x="13.4" y="13.4" width="7.6" height="7.6" rx="2.2" />
  </Solid>
);

export const IconUserPlus = (p: P) => (
  <Solid {...p}>
    <circle cx="10" cy="7.6" r="4.2" />
    <path d="M1.6 20a8.4 8.4 0 0 1 16.8 0c0 .8-.6 1.4-1.4 1.4H3a1.4 1.4 0 0 1-1.4-1.4z" />
    <path d="M18.4 6.2h2v2.6H23v2h-2.6v2.6h-2v-2.6h-2.6v-2h2.6z" style={soft} />
  </Solid>
);

export const IconCake = (p: P) => (
  <Solid {...p}>
    <path d="M12 1.8c1.1 1.5 2 2.7 2 3.9a2 2 0 1 1-4 0c0-1.2.9-2.4 2-3.9z" style={soft} />
    <path d="M6.5 9h11a2.5 2.5 0 0 1 2.5 2.5v1.8c-.9.9-2 .9-3 0-1 .9-2 .9-3 0-1 .9-2 .9-3 0-1 .9-2 .9-3 0-1 .9-2 .9-3 0-.3.3-.7.5-1 .6V11.5A2.5 2.5 0 0 1 6.5 9z" />
    <path d="M3 15.6c.6.5 1.3.5 2 0 1 .9 2 .9 3 0 1 .9 2 .9 3 0 1 .9 2 .9 3 0 1 .9 2 .9 3 0 1 .9 2 .9 3 0 .5.4 1 .4 1.5.2V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Solid>
);
