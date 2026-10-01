import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME, LogoMark } from "./logo";

/** 개인정보처리방침 · 고객지원처럼 로그인 없이 누구나 보는 안내 화면의 틀 */
export function LegalShell({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={32} decorative />
            <span className="font-bold text-ink">{APP_NAME}</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-8">
        <h1 className="title text-[1.7rem] leading-tight text-ink">{title}</h1>
        {updated && <p className="mt-2 text-sm text-ink-3">{updated}</p>}
        <div className="legal mt-8 space-y-8 text-[0.95rem] leading-relaxed text-ink-2">{children}</div>
        <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-6 text-sm text-ink-3">
          <Link href="/privacy" className="hover:text-primary">개인정보처리방침</Link>
          <Link href="/support" className="hover:text-primary">고객지원</Link>
          <Link href="/login" className="hover:text-primary">로그인</Link>
        </nav>
      </main>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 text-[1.05rem] font-bold text-ink">{title}</h2>
      <div className="space-y-2.5 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">{children}</div>
    </section>
  );
}
