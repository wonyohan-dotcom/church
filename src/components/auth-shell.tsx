import type { ReactNode } from "react";
import { APP_NAME, LOGO_COLORS, LogoMark } from "./logo";

/**
 * 로그인 · 가입 신청 · 교회 등록 화면의 틀.
 * 넓은 화면에서는 왼쪽에 로고의 고딕 창을 크게 그린 남색 면을 두고,
 * 휴대폰에서는 위쪽에 로고와 이름만 간단히 둔다.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <BrandPanel />
      <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-12 lg:px-12">
        <div className="w-full max-w-[24rem]">
          <div className="mb-9 flex flex-col items-center text-center lg:hidden">
            <LogoMark size={60} decorative />
            <p className="title-serif mt-4 text-[1.35rem] text-ink">{APP_NAME}</p>
          </div>
          {title && (
            <div className="mb-6 text-center lg:text-left">
              <h1 className="title-serif text-[1.5rem] leading-tight text-ink lg:text-[1.9rem]">{title}</h1>
              {description && (
                <p className="mt-2 text-sm leading-relaxed text-ink-3">{description}</p>
              )}
            </div>
          )}
          {children}
          {footer && <div className="mt-6 space-y-2.5 text-center text-sm lg:text-left">{footer}</div>}
        </div>
      </div>
    </main>
  );
}

function BrandPanel() {
  const { bg, gold } = LOGO_COLORS;
  const paper = "#f4efe6";
  return (
    <aside
      className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12"
      style={{ background: bg, color: paper }}
    >
      {/* 교회 창(고딕 아치)을 크게, 선으로만 겹쳐 그린 무늬 */}
      <svg
        viewBox="0 0 100 100"
        className="pointer-events-none absolute -bottom-[18%] -right-[22%] h-[125%] w-auto opacity-[0.16]"
        aria-hidden
      >
        {[0, 5, 10].map((inset) => (
          <path
            key={inset}
            d={`M${30 + inset * 0.6} 100V50C${30 + inset * 0.6} 34 ${38.5 + inset * 0.3} ${22 + inset * 0.4} 50 ${15 + inset}C${61.5 - inset * 0.3} ${22 + inset * 0.4} ${70 - inset * 0.6} 34 ${70 - inset * 0.6} 50V100`}
            fill="none"
            stroke={gold}
            strokeWidth="0.35"
          />
        ))}
        <path d="M50 25V100M30 48H70" stroke={gold} strokeWidth="0.35" />
      </svg>

      <div className="relative flex items-center gap-3">
        <LogoMark size={40} decorative className="rounded-[10px] ring-1 ring-white/15" />
        <span className="text-[0.95rem] font-semibold tracking-[-0.01em]">{APP_NAME}</span>
      </div>

      <div className="relative max-w-md">
        <p className="title-serif text-[2.1rem] leading-[1.35]">
          교회의 살림을
          <br />
          단정하게 기록합니다
        </p>
        <p className="mt-5 text-sm leading-relaxed opacity-70">
          교적과 출석, 심방, 헌금과 지출, 기부금영수증, 교회의 역사까지.
          <br />
          한 곳에서, 필요한 사람만 볼 수 있게.
        </p>
      </div>
    </aside>
  );
}
