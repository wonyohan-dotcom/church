import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { STAFF_ROLES, type Role } from "@/lib/constants";
import { AuthShell } from "@/components/auth-shell";
import { isNativeApp } from "@/lib/native-app";
import { LoginForm } from "./login-form";

export const metadata = { title: "로그인" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; demo?: string; deleted?: string }>;
}) {
  const session = await getSession();
  if (session) {
    if (session.status !== "ACTIVE") redirect("/pending");
    redirect(STAFF_ROLES.includes(session.role as Role) ? "/dashboard" : "/my");
  }

  const { next, demo, deleted } = await searchParams;
  const native = await isNativeApp();

  return (
    <AuthShell
      title="로그인"
      description="교회에서 받은 아이디로 들어오세요."
      footer={
        <>
          <p className="text-ink-2">
            처음이신가요?{" "}
            <Link href="/signup" className="font-semibold text-primary hover:underline">
              성도 가입 신청
            </Link>
          </p>
          {!native && (
            <p className="text-ink-3">
              교회를 새로 등록하시려면{" "}
              <Link href="/register-church" className="font-semibold text-primary hover:underline">
                교회 등록
              </Link>
            </p>
          )}
        </>
      }
    >
      {deleted && (
        <p className="mb-4 rounded-lg bg-income-soft px-3 py-2.5 text-sm font-medium text-income">
          {deleted === "church" ? "교회와 모든 자료를 삭제했습니다." : "계정을 삭제했습니다."} 그동안 함께해 주셔서 감사합니다.
        </p>
      )}
      {demo === "fail" && (
        <p className="mb-4 rounded-lg bg-expense-soft px-3 py-2.5 text-sm font-medium text-expense">
          체험용 교회를 여는 중 문제가 생겼습니다. 잠시 뒤 다시 눌러 주세요.
        </p>
      )}
      <div className="card p-6">
        <LoginForm next={next ?? ""} />
      </div>
      <div className="mt-4 rounded-2xl border border-line bg-surface-2 p-4">
        <p className="text-center text-sm font-bold text-ink">회원가입 없이 둘러보기</p>
        <p className="mt-0.5 text-center text-xs text-ink-3">예시 자료가 든 체험용 교회로 바로 들어갑니다.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href="/demo" className="btn btn-primary py-3">
            관리자 화면
          </a>
          <a href="/demo?as=member" className="btn btn-ghost bg-surface py-3">
            성도 화면
          </a>
        </div>
      </div>
    </AuthShell>
  );
}
