import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { isNativeApp } from "@/lib/native-app";
import { SignupForm } from "./form";

export const metadata = { title: "가입 신청" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/");

  const native = await isNativeApp();
  const churches = await prisma.church.findMany({
    where: { joinOpen: true, isDemo: false },
    select: { id: true, name: true, address: true },
    orderBy: { name: "asc" },
  });

  return (
    <AuthShell
      title="가입 신청"
      description="출석하시는 교회를 찾아 신청하시면 교회에서 확인 후 승인해 드립니다."
      footer={
        <p className="text-ink-2">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            로그인
          </Link>
        </p>
      }
    >
      {churches.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm leading-relaxed text-ink-2">
            아직 등록된 교회가 없습니다.
            <br />
            {native ? "교회에서 가입을 열면 여기에 나타납니다." : "교회를 먼저 등록해 주세요."}
          </p>
          {!native && (
            <Link href="/register-church" className="btn btn-primary mt-4">
              교회 등록하기
            </Link>
          )}
        </div>
      ) : (
        <div className="card p-6">
          <SignupForm churches={churches} />
        </div>
      )}
    </AuthShell>
  );
}
