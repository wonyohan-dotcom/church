import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { Alert, PageHeader } from "@/components/ui";
import { HistoryForm } from "../../history-form";
import { updateHistoryEvent } from "../../actions";

export const metadata = { title: "연혁 수정" };

export default async function EditHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const staff = await requireStaff();
  const { id } = await params;
  const { error } = await searchParams;

  const event = await prisma.historyEvent.findUnique({ where: { id } });
  if (!event || event.churchId !== staff.churchId) notFound();

  return (
    <>
      <PageHeader
        title="연혁 수정"
        description={event.title}
        back={{ href: `/history/${event.id}`, label: "연혁 상세" }}
      />

      {error && (
        <div className="mb-5">
          <Alert tone="expense">제목과 날짜는 반드시 입력해야 합니다.</Alert>
        </div>
      )}

      <HistoryForm
        action={updateHistoryEvent.bind(null, event.id)}
        event={event}
        cancelHref={`/history/${event.id}`}
        submitLabel="저장하기"
      />
    </>
  );
}
