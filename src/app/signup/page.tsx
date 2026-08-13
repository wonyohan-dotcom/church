import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { LogoLockup } from "@/components/logo";
import { SignupForm } from "./form";

export const metadata = { title: "가입 신청" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/");

  const churches = await prisma.church.findMany({
    where: { joinOpen: true },
    select: { id: true, name: true, address: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-[26rem]">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-5">
            <LogoLockup size={44} tagline={null} />
          </div>
          <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">가입 신청</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
            출석하시는 교회를 찾아 신청하시면
            <br />
            교회에서 확인 후 승인해 드립니다.
          </p>
        </div>

        {churches.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm leading-relaxed text-ink-2">
              아직 등록된 교회가 없습니다.
              <br />
              교회를 먼저 등록해 주세요.
            </p>
            <Link href="/register-church" className="btn btn-primary mt-4">
              교회 등록하기
            </Link>
          </div>
        ) : (
          <div className="card p-6">
            <SignupForm churches={churches} />
          </div>
        )}

        <p className="mt-5 text-center text-sm text-ink-2">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
