import { requireStaff, canManageFinance } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { prisma } from "@/lib/prisma";
import { MobileTabBar, MobileTopBar, Sidebar } from "@/components/nav";
import { DemoBanner } from "@/components/demo-banner";
import { communityEnabled } from "@/lib/native-app";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const church = await getChurch(user.churchId);
  const community = await communityEnabled(user.churchId);

  // 메뉴 옆에 "처리할 일이 있다" 는 숫자를 붙인다.
  const finance = canManageFinance(user.role);
  const [bank, receipts, signups] = await Promise.all([
    finance ? prisma.bankAlert.count({ where: { churchId: user.churchId, status: "PENDING" } }) : 0,
    finance
      ? prisma.donationReceipt.count({ where: { churchId: user.churchId, status: "REQUESTED" } })
      : 0,
    user.role === "ADMIN"
      ? prisma.user.count({ where: { churchId: user.churchId, status: "PENDING" } })
      : 0,
  ]);
  const badges = { "/finance/bank": bank, "/receipts": receipts, "/settings": signups };

  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar churchName={church.name} user={{ name: user.name, role: user.role }} badges={badges} community={community} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar churchName={church.name} />
        {church.isDemo && <DemoBanner />}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-14">
          {children}
        </main>
        <MobileTabBar role={user.role} badges={badges} />
      </div>
    </div>
  );
}
