import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { STAFF_ROLES, USER_STATUS, type Role, type UserStatus } from "@/lib/constants";
import { IconClock, IconCross, IconLogout, IconX } from "@/components/icons";

export const metadata = { title: "승인 대기" };
export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // 세션은 12시간 유지되므로, 그 사이 승인되었는지 실제 상태를 다시 읽는다.
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { church: { select: { name: true, phone: true } } },
  });
  if (!user) redirect("/login");

  if (user.status === "ACTIVE") {
    // 승인이 끝났으면 새 정보로 세션을 갱신하도록 다시 로그인시킨다.
    redirect(STAFF_ROLES.includes(user.role as Role) ? "/dashboard" : "/my");
  }

  const rejected = user.status === "REJECTED";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-[24rem] text-center">
        <span
          className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${
            rejected ? "bg-expense-soft text-expense" : "bg-warn-soft text-warn"
          }`}
        >
          {rejected ? <IconX width={28} height={28} /> : <IconClock width={28} height={28} />}
        </span>

        <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">
          {rejected ? "가입이 거절되었습니다" : "승인을 기다리고 있습니다"}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          {rejected ? (
            <>
              {user.rejectReason ? (
                <>사유: {user.rejectReason}</>
              ) : (
                <>자세한 내용은 교회 사무실에 문의해 주세요.</>
              )}
            </>
          ) : (
            <>
              <span className="font-semibold text-ink">{user.church.name}</span>에 가입을
              신청하셨습니다.
              <br />
              교회에서 확인하고 승인하면 바로 이용하실 수 있습니다.
            </>
          )}
        </p>

        <div className="card mt-6 p-5 text-left">
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">교회</dt>
              <dd className="font-medium text-ink">{user.church.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">이름</dt>
              <dd className="font-medium text-ink">{user.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">아이디</dt>
              <dd className="tnum font-medium text-ink">{user.loginId}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">상태</dt>
              <dd className="font-medium text-ink">
                {USER_STATUS[user.status as UserStatus] ?? user.status}
              </dd>
            </div>
          </dl>

          {user.church.phone && (
            <a
              href={`tel:${user.church.phone.replace(/\D/g, "")}`}
              className="btn btn-ghost btn-sm mt-4 w-full"
            >
              교회 사무실 전화 · {user.church.phone}
            </a>
          )}
        </div>

        {!rejected && (
          <p className="mt-5 text-xs leading-relaxed text-ink-3">
            승인되면 이 화면이 자동으로 넘어갑니다.
            <br />
            새로고침해서 확인해 보세요.
          </p>
        )}

        <form action="/api/logout" method="post" className="mt-6">
          <button type="submit" className="btn btn-quiet">
            <IconLogout width={16} height={16} />
            로그아웃
          </button>
        </form>

        <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-ink-3">
          <IconCross width={13} height={13} />
          교회 통합 관리 시스템
        </p>
      </div>
    </main>
  );
}
