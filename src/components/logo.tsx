/**
 * 심플한교회관리 로고 — 심플한신앙(SF)의 형제 앱
 *
 * 심플한신앙 아이콘과 같은 짙은 청록빛 남색 바탕, 금빛 굵은 글자를 쓰고
 * 글자만 "SC"(Simple Church)로 바꿨다. 옆에 청록 십자가를 붙여
 * 교회 앱이라는 점과 두 앱의 구분이 한눈에 보이게 했다.
 * 글자는 Pretendard Black 을 도형으로 바꾼 것이라 글꼴이 없어도 똑같이 보인다.
 *
 * 앱 아이콘·파비콘 PNG 는 scripts/render-icons.mjs 가 같은 모양으로 만든다.
 */

export const APP_NAME = "심플한교회관리";
export const APP_TAGLINE = "교적 · 회계 · 출석 · 기부금영수증";

export const LOGO_COLORS = { bg: "#142f3b", gold: "#f7b56b", cross: "#16a097" } as const;

/** 100×100 기준 로고 도형. 배경 사각형은 포함하지 않는다. */
export const LOGO_PATHS = {
  letters: "M32.60 44.07L40.47 44.07C40.42 38.01 35.74 34.02 28.26 34.02C20.96 34.02 15.76 37.97 15.80 43.86C15.80 48.67 19.15 51.38 24.61 52.58L27.75 53.27C31.23 54.04 32.47 54.90 32.52 56.40C32.47 58.04 30.97 59.20 28.18 59.20C24.95 59.20 22.93 57.65 22.80 54.77L14.98 54.77C15.07 62.42 20.27 65.94 28.30 65.94C36.17 65.94 40.85 62.50 40.89 56.40C40.85 51.63 37.89 48.37 31.18 46.95L28.61 46.35C25.73 45.75 24.27 44.84 24.31 43.25C24.35 41.79 25.55 40.76 28.26 40.76C31.05 40.76 32.43 41.96 32.60 44.07ZM61.22 46.00L69.52 46.00C68.83 38.36 63.20 34.02 55.46 34.02C47.09 34.02 40.51 39.64 40.51 50C40.51 60.31 46.91 65.98 55.46 65.98C64.40 65.98 69.09 59.80 69.52 54.47L61.22 54.38C60.79 57.13 58.77 58.85 55.64 58.85C51.43 58.85 48.93 55.84 48.93 50C48.93 44.46 51.38 41.15 55.68 41.15C58.99 41.15 60.96 43.08 61.22 46.00Z",
  cross: "M78.52 33.02V51.02M72.52 38.52H84.52",
} as const;

/** 로고 도형(배경 제외). 아이콘 PNG 를 만드는 스크립트도 같은 값을 읽는다. */
function Glyphs() {
  return (
    <>
      <path d={LOGO_PATHS.letters} fill={LOGO_COLORS.gold} />
      <path
        d={LOGO_PATHS.cross}
        stroke={LOGO_COLORS.cross}
        strokeWidth="3.6"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

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
      <rect width="100" height="100" rx="26" fill={LOGO_COLORS.bg} />
      <Glyphs />
    </svg>
  );
}

/** 남색 바탕 위에 올릴 때 쓰는 배경 없는 로고 */
export function LogoGlyphs({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <Glyphs />
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
