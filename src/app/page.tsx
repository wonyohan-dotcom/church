import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { STAFF_ROLES, type Role } from "@/lib/constants";

export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(STAFF_ROLES.includes(session.role as Role) ? "/dashboard" : "/my");
}
