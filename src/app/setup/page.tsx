import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { DEFAULT_ACCOUNTS } from "@/lib/constants";
import { IconCross } from "@/components/icons";
import { SubmitButton } from "@/components/form";

export const metadata = { title: "최초 설정" };

async function setup(formData: FormData) {
  "use server";

  // 이미 계정이 있으면 이 화면으로 새 관리자를 만들 수 없다.
  if ((await prisma.user.count()) > 0) redirect("/login");

  const churchName = String(formData.get("churchName") ?? "").trim() || "우리교회";
  const name = String(formData.get("name") ?? "").trim();
  const loginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !loginId || password.length < 8) {
    redirect("/setup?error=1");
  }

  const user = await prisma.user.create({
    data: {
      loginId,
      name,
      password: await hashPassword(password),
      role: "ADMIN",
    },
  });

  await prisma.churchSetting.upsert({
    where: { id: "singleton" },
    update: { name: churchName },
    create: { id: "singleton", name: churchName },
  });

  // 기본 계정과목을 미리 깔아두어 바로 회계 입력을 시작할 수 있게 한다.
  await prisma.account.createMany({
    data: DEFAULT_ACCOUNTS.map((a, i) => ({
      code: a.code,
      name: a.name,
      type: a.type,
      category: a.category ?? null,
      isOffering: a.isOffering ?? false,
      deductible: a.deductible ?? true,
      sortOrder: i,
    })),
  });

  await createSession({
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    role: "ADMIN",
    memberId: null,
  });

  redirect("/dashboard");
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if ((await prisma.user.count()) > 0) redirect("/login");
  await getChurch();
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-[26rem]">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-ink shadow-[var(--shadow)]">
            <IconCross width={26} height={26} />
          </span>
          <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">환영합니다</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
            처음 한 번만 진행하는 설정입니다.
            <br />
            교회 이름과 관리자 계정을 만들어 주세요.
          </p>
        </div>

        <form action={setup} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="churchName">
              교회 이름
            </label>
            <input
              id="churchName"
              name="churchName"
              className="field"
              placeholder="예) 은혜교회"
              required
              autoFocus
            />
          </div>

          <hr className="border-line" />

          <div>
            <label className="label" htmlFor="name">
              관리자 이름
            </label>
            <input id="name" name="name" className="field" placeholder="예) 홍길동" required />
          </div>

          <div>
            <label className="label" htmlFor="loginId">
              관리자 아이디
            </label>
            <input
              id="loginId"
              name="loginId"
              className="field"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="영문·숫자 조합"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="field"
              minLength={8}
              placeholder="8자 이상"
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-expense-soft px-3 py-2.5 text-sm font-medium text-expense">
              입력한 내용을 다시 확인해 주세요. 비밀번호는 8자 이상이어야 합니다.
            </p>
          )}

          <SubmitButton className="btn btn-primary w-full py-3" pendingLabel="설정 중…">
            시작하기
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
