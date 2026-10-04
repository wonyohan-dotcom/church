import Link from "next/link";
import { requireUser, isStaff } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { prisma } from "@/lib/prisma";
import { CommunityNav } from "./community-nav";
import { agreeCommunity } from "./actions";
import { SubmitButton } from "@/components/form";
import { DemoBanner } from "@/components/demo-banner";
import { redirect } from "next/navigation";
import { communityEnabled } from "@/lib/native-app";

export const metadata = { title: "교회 소통" };

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!(await communityEnabled())) redirect(isStaff(user.role) ? "/dashboard" : "/my");
  const [church, me] = await Promise.all([
    getChurch(user.churchId),
    prisma.user.findUnique({ where: { id: user.id }, select: { communityAgreedAt: true } }),
  ]);
  const home = isStaff(user.role) ? "/dashboard" : "/my";
  const agreed = !!me?.communityAgreedAt;

  return (
    <div className="min-h-dvh bg-bg">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link href={home} className="btn btn-quiet btn-sm shrink-0" aria-label="홈으로">
            ←
          </Link>
          <div className="min-w-0">
            <p className="truncate text-[0.95rem] font-bold leading-tight text-ink">교회 소통</p>
            <p className="truncate text-[0.7rem] text-ink-3">{church.name}</p>
          </div>
        </div>
        {agreed && (
          <div className="mx-auto max-w-2xl px-4">
            <CommunityNav />
          </div>
        )}
      </header>
      {church.isDemo && <DemoBanner />}
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-5">
        {agreed ? children : <Terms />}
      </main>
    </div>
  );
}

function Terms() {
  return (
    <div className="card p-6">
      <h1 className="title text-[1.35rem] text-ink">교회 소통을 시작하기 전에</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        사진을 나누고, 댓글과 채팅으로 이야기하고, 이번 주 주보를 보는 우리 교회 안의 공간입니다.
        같은 교회 성도만 볼 수 있습니다.
      </p>
      <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-2 [&_li]:ml-5 [&_li]:list-disc">
        <li>서로 존중해 주세요. 욕설·비방·음란물·광고·타인의 개인정보를 올리는 것은 허용되지 않습니다.</li>
        <li>다른 사람이 나온 사진은 그분의 동의를 받고 올려 주세요. 특히 어린이 사진은 보호자의 허락을 받아 주세요.</li>
        <li>부적절한 글·댓글·채팅은 <b>⋯ 메뉴</b>에서 <b>신고</b>할 수 있고, 불편한 사람은 <b>차단</b>하면 그 사람의 글이 보이지 않습니다.</li>
        <li>신고된 내용은 교회 관리자가 확인해 삭제하며, 반복하면 이용이 제한됩니다.</li>
        <li>내가 올린 글은 언제든 지울 수 있고, 계정을 삭제하면 함께 지워집니다.</li>
      </ul>
      <form action={agreeCommunity} className="mt-6">
        <SubmitButton className="btn btn-primary w-full" pendingLabel="잠시만요…">
          동의하고 시작하기
        </SubmitButton>
      </form>
    </div>
  );
}
