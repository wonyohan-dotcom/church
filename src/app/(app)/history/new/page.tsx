import { requireStaff } from "@/lib/auth";
import { Alert, PageHeader } from "@/components/ui";
import { HistoryForm } from "../history-form";
import { createHistoryEvent } from "../actions";

export const metadata = { title: "연혁 등록" };

export default async function NewHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff();
  const { error } = await searchParams;

  return (
    <>
      <PageHeader
        title="연혁 등록"
        description="교회의 발자취를 사진과 함께 남깁니다."
        back={{ href: "/history", label: "교회 역사" }}
      />

      {error && (
        <div className="mb-5">
          <Alert tone="expense">제목과 날짜는 반드시 입력해야 합니다.</Alert>
        </div>
      )}

      <HistoryForm action={createHistoryEvent} cancelHref="/history" submitLabel="등록하기" />
    </>
  );
}
