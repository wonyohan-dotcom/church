import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { MemberImporter } from "./member-importer";

export const metadata = { title: "엑셀로 교인 등록" };

export default async function MemberImportPage() {
  await requireStaff();
  return (
    <>
      <PageHeader
        eyebrow="교인"
        title="엑셀로 한꺼번에 등록"
        description="교적 엑셀 파일을 올리면 명단을 알아보고, 확인한 뒤 한 번에 등록합니다."
        back={{ href: "/members", label: "교적 관리" }}
      />
      <MemberImporter />
    </>
  );
}
