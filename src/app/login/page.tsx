import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { STAFF_ROLES, type Role } from "@/lib/constants";
import { AuthShell } from "@/components/auth-shell";
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
          <p className="text-ink-3">
            교회를 새로 등록하시려면{" "}
            <Link href="/register-church" className="font-semibold text-primary hover:underline">
              교회 등록
            </Link>
          </p>
        </>
      }
    >
      <div className="card p-6">
        <LoginForm next={next ?? ""} />
      </div>
    </AuthShell>
  );
}
