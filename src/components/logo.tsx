/**
 * 심플한교회관리 로고 — "빛이 드는 고딕 창"
 *
 * 뾰족한 고딕 아치 창을 창살이 네 칸으로 나누고, 그 창살이 그대로 십자가가 된다.
 * 위쪽 두 칸은 빛이 드는 듯 금빛으로, 아래 두 칸은 종이(장부) 빛으로 칠했다.
 * 16px 파비콘까지 형태가 남도록 면으로만 그렸다(선 없음).
 *
 * 앱 아이콘·파비콘 PNG 는 scripts/render-icons.mjs 가 같은 모양으로 만든다.
 */

export const APP_NAME = "심플한교회관리";
export const APP_TAGLINE = "교적 · 회계 · 출석 · 기부금영수증";

export const LOGO_COLORS = { bg: "#1c2a47", light: "#d4ab78", paper: "#f5eee2" } as const;

/** 100×100 기준 로고 도형. 배경 사각형은 포함하지 않는다. */
export const LOGO_PATHS = {
  arch: "M30 82V50C30 34 38.5 22 50 15C61.5 22 70 34 70 50V82Z",
  lower: "M30 48H70V82H30Z",
  mullions: "M47.8 25H52.2V84H47.8ZM28 45.8H72V50.2H28Z",
} as const;

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
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      {...(decorative
        ? { "aria-hidden": true as const }
        : { role: "img", "aria-label": APP_NAME })}
    >
      <rect width="100" height="100" rx="23" fill={LOGO_COLORS.bg} />
      <path d={LOGO_PATHS.arch} fill={LOGO_COLORS.light} />
      <path d={LOGO_PATHS.lower} fill={LOGO_COLORS.paper} />
      <path d={LOGO_PATHS.mullions} fill={LOGO_COLORS.bg} />
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
