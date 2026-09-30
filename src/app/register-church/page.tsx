import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { RegisterChurchForm } from "./form";

export const metadata = { title: "교회 등록" };
export const dynamic = "force-dynamic";

export default async function RegisterChurchPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <AuthShell
      title="교회 등록"
      description="우리 교회를 새로 등록합니다. 등록하신 분이 첫 관리자가 됩니다."
      footer={
        <p className="text-ink-2">
          이미 등록된 교회의 성도이신가요?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            가입 신청
          </Link>
        </p>
      }
    >
      <div className="card p-6">
        <RegisterChurchForm />
      </div>
    </AuthShell>
  );
}
