import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { Alert, PageHeader } from "@/components/ui";
import { MemberForm } from "../member-form";
import { createMember } from "../actions";

export const metadata = { title: "교인 등록" };

const ERRORS: Record<string, string> = {
  name: "이름은 반드시 입력해야 합니다.",
  photo: "사진을 저장하지 못했습니다. 8MB 이하의 이미지 파일인지 확인해 주세요.",
};

export default async function NewMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff();
  const { error } = await searchParams;

  const [districts, households] = await Promise.all([
    prisma.district.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.household.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="교인 등록"
        description="새 교인의 교적을 만듭니다. 교적번호는 자동으로 부여됩니다."
        back={{ href: "/members", label: "교적 관리" }}
      />

      {error && (
        <div className="mb-5">
          <Alert tone="expense">{ERRORS[error] ?? "저장 중 문제가 발생했습니다."}</Alert>
        </div>
      )}

      <MemberForm
        action={createMember}
        districts={districts}
        households={households}
        cancelHref="/members"
        submitLabel="등록하기"
      />
    </>
  );
}
