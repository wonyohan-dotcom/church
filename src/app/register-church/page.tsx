import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LogoLockup } from "@/components/logo";
import { RegisterChurchForm } from "./form";

export const metadata = { title: "교회 등록" };
export const dynamic = "force-dynamic";

export default async function RegisterChurchPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-[26rem]">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-5">
            <LogoLockup size={44} tagline={null} />
          </div>
          <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">교회 등록</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
            우리 교회를 새로 등록합니다.
            <br />
            등록하신 분이 첫 관리자가 됩니다.
          </p>
        </div>

        <div className="card p-6">
          <RegisterChurchForm />
        </div>

        <p className="mt-5 text-center text-sm text-ink-2">
          이미 등록된 교회의 성도이신가요?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            가입 신청
          </Link>
        </p>
      </div>
    </main>
  );
}
