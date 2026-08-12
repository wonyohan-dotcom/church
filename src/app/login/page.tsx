import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { STAFF_ROLES, type Role } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { IconCross } from "@/components/icons";
import { LoginForm } from "./login-form";

export const metadata = { title: "로그인" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect(STAFF_ROLES.includes(session.role as Role) ? "/dashboard" : "/my");
  }

  // 계정이 하나도 없으면 최초 설치 화면으로 안내한다.
  const userCount = await prisma.user.count();
  if (userCount === 0) redirect("/setup");

  const church = await getChurch();
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-[22rem]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-ink shadow-[var(--shadow)]">
            <IconCross width={26} height={26} />
          </span>
          <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">{church.name}</h1>
          <p className="mt-1 text-sm text-ink-3">통합 관리 시스템</p>
        </div>

        <div className="card p-6">
          <LoginForm next={next ?? ""} />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-ink-3">
          성도님은 교회에서 발급받은 아이디로 로그인하시면
          <br />
          헌금 내역과 기부금영수증을 확인하실 수 있습니다.
        </p>
      </div>
    </main>
  );
}
