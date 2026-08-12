import { requireStaff } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { MobileTabBar, MobileTopBar, Sidebar } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const church = await getChurch(user.churchId);

  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar churchName={church.name} user={{ name: user.name, role: user.role }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar churchName={church.name} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:pb-12">
          {children}
        </main>
        <MobileTabBar />
      </div>
    </div>
  );
}
