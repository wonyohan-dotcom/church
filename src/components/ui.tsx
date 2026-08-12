import Link from "next/link";
import type { ReactNode } from "react";

/* ── 페이지 헤더 ─────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 transition-colors hover:text-ink"
        >
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.55rem] font-bold leading-tight tracking-[-0.02em] text-ink">
            {title}
          </h1>
          {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/* ── 카드 ────────────────────────────────── */

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`card ${padded ? "p-5" : ""} ${className}`}>{children}</section>
  );
}

export function CardTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[0.95rem] font-bold tracking-[-0.01em] text-ink">{children}</h2>
      {action}
    </div>
  );
}

/* ── 통계 타일 ───────────────────────────── */

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "income" | "expense" | "primary";
  icon?: ReactNode;
}) {
  const toneClass =
    tone === "income"
      ? "text-income"
      : tone === "expense"
        ? "text-expense"
        : tone === "primary"
          ? "text-primary"
          : "text-ink";
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.78rem] font-semibold tracking-[0.01em] text-ink-3">{label}</p>
        {icon && <span className="text-ink-3">{icon}</span>}
      </div>
      <p className={`tnum mt-2 text-[1.5rem] font-bold leading-tight ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-3">{sub}</p>}
    </div>
  );
}

/* ── 배지 ────────────────────────────────── */

type Tone = "neutral" | "primary" | "income" | "expense" | "warn" | "accent";

const TONE_STYLE: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-2",
  primary: "bg-primary-soft text-primary-soft-ink",
  income: "bg-income-soft text-income",
  expense: "bg-expense-soft text-expense",
  warn: "bg-warn-soft text-warn",
  accent: "bg-accent-soft text-accent",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return <span className={`badge ${TONE_STYLE[tone]}`}>{children}</span>;
}

/* ── 빈 상태 ─────────────────────────────── */

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-3">
          {icon}
        </div>
      )}
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── 폼 필드 ─────────────────────────────── */

export function Field({
  label,
  children,
  hint,
  required,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {required && <span className="ml-0.5 text-expense">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

/* ── 정의형 목록 (상세 화면) ─────────────── */

export function DescList({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-line">{children}</dl>;
}

export function DescItem({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2.5 text-sm sm:grid-cols-[9rem_1fr]">
      <dt className="font-medium text-ink-3">{term}</dt>
      <dd className="min-w-0 break-words text-ink">{children ?? "-"}</dd>
    </div>
  );
}

/* ── 알림 배너 ───────────────────────────── */

export function Alert({
  tone = "primary",
  children,
}: {
  tone?: "primary" | "warn" | "expense" | "income";
  children: ReactNode;
}) {
  const map = {
    primary: "bg-primary-soft text-primary-soft-ink",
    warn: "bg-warn-soft text-warn",
    expense: "bg-expense-soft text-expense",
    income: "bg-income-soft text-income",
  } as const;
  return (
    <div className={`rounded-xl px-4 py-3 text-sm font-medium ${map[tone]}`}>{children}</div>
  );
}

/* ── 교인 사진 ───────────────────────────── */

const AVATAR_SIZE = { sm: "h-9 w-9 text-xs", md: "h-12 w-12 text-sm", lg: "h-24 w-24 text-xl" };

export function Avatar({
  src,
  name,
  size = "sm",
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof AVATAR_SIZE;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3 font-semibold text-ink-2 ${AVATAR_SIZE[size]}`}
    >
      {src ? (
        // 업로드된 사진은 임의 경로라 next/image 최적화 대신 기본 img를 쓴다.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  );
}

/* ── 가로 스크롤 표 래퍼 ─────────────────── */

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="card overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
      {children}
    </div>
  );
}
