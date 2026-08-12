import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { Alert, PageHeader } from "@/components/ui";
import { MemberForm } from "../../member-form";
import { updateMember } from "../../actions";

export const metadata = { title: "교적 수정" };

const ERRORS: Record<string, string> = {
  name: "이름은 반드시 입력해야 합니다.",
  photo: "사진을 저장하지 못했습니다. 8MB 이하의 이미지 파일인지 확인해 주세요.",
};

export default async function EditMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const { error } = await searchParams;

  const [member, districts, households] = await Promise.all([
    prisma.member.findUnique({ where: { id } }),
    prisma.district.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.household.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!member) notFound();

  return (
    <>
      <PageHeader
        title={`${member.name} 교적 수정`}
        description={`교적번호 ${member.code}`}
        back={{ href: `/members/${member.id}`, label: "교인 상세" }}
      />

      {error && (
        <div className="mb-5">
          <Alert tone="expense">{ERRORS[error] ?? "저장 중 문제가 발생했습니다."}</Alert>
        </div>
      )}

      <MemberForm
        action={updateMember.bind(null, member.id)}
        member={member}
        districts={districts}
        households={households}
        cancelHref={`/members/${member.id}`}
        submitLabel="저장하기"
      />
    </>
  );
}
