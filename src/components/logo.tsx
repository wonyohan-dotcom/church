/**
 * 심플한교회관리 로고.
 *
 * 위쪽 십자가는 교회를, 아래 두 줄은 장부(기록)를 뜻한다.
 * 24px 앱 아이콘까지 형태가 뭉개지지 않도록 획 굵기와 간격을 잡았다.
 */

export const APP_NAME = "심플한교회관리";
export const APP_TAGLINE = "교적 · 회계 · 기부금영수증";

export function LogoMark({
  size = 36,
  className = "",
  /** 옆에 이름이 이미 적혀 있으면 true. 화면 낭독기가 같은 이름을 두 번 읽지 않게 한다. */
  decorative = false,
}: {
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      {...(decorative
        ? { "aria-hidden": true as const }
        : { role: "img", "aria-label": APP_NAME })}
    >
      <rect width="64" height="64" rx="15" fill="var(--logo-bg, #22355c)" />
      {/* 십자가 — 교회 */}
      <path
        d="M32 13v23M22 21.5h20"
        stroke="var(--logo-cross, #ffffff)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* 장부 두 줄 — 기록 */}
      <path
        d="M19 45h26M19 53.5h16"
        stroke="var(--logo-accent, #d0a273)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 로고 + 이름을 가로로 묶은 조합. 로그인·가입 화면 머리에 쓴다. */
export function LogoLockup({
  size = 44,
  tagline = APP_TAGLINE,
  align = "center",
}: {
  size?: number;
  tagline?: string | null;
  align?: "center" | "left";
}) {
  return (
    <div
      className={`flex items-center gap-3 ${align === "center" ? "justify-center" : ""}`}
    >
      <LogoMark size={size} decorative className="shrink-0 drop-shadow-[var(--shadow-sm)]" />
      <div className={align === "center" ? "text-left" : ""}>
        <p className="text-[1.05rem] font-extrabold leading-tight tracking-[-0.03em] text-ink">
          {APP_NAME}
        </p>
        {tagline && <p className="mt-0.5 text-[0.72rem] text-ink-3">{tagline}</p>}
      </div>
    </div>
  );
}
