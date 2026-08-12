import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { STAFF_ROLES, type Role } from "@/lib/constants";
import { IconCross } from "@/components/icons";
import { LoginForm } from "./login-form";

export const metadata = { title: "로그인" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) {
    if (session.status !== "ACTIVE") redirect("/pending");
    redirect(STAFF_ROLES.includes(session.role as Role) ? "/dashboard" : "/my");
  }

  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-[22rem]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-ink shadow-[var(--shadow)]">
            <IconCross width={26} height={26} />
          </span>
          <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">
            교회 통합 관리 시스템
          </h1>
          <p className="mt-1 text-sm text-ink-3">교적 · 회계 · 기부금영수증</p>
        </div>

        <div className="card p-6">
          <LoginForm next={next ?? ""} />
        </div>

        <div className="mt-5 space-y-2.5 text-center">
          <p className="text-sm text-ink-2">
            처음이신가요?{" "}
            <Link href="/signup" className="font-semibold text-primary hover:underline">
              성도 가입 신청
            </Link>
          </p>
          <p className="text-sm text-ink-3">
            교회를 새로 등록하시려면{" "}
            <Link
              href="/register-church"
              className="font-semibold text-primary hover:underline"
            >
              교회 등록
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
