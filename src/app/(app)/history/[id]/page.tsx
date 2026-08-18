import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { HISTORY_CATEGORIES, type HistoryCategory } from "@/lib/constants";
import { ymd } from "@/lib/format";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/form";
import { deleteHistoryEvent, deleteHistoryPhoto } from "../actions";
import { MAX_HISTORY_PHOTOS } from "@/lib/constants";
import { HistoryPhotoUploader } from "./photo-uploader";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await prisma.historyEvent.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: event?.title ?? "연혁" };
}

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireStaff();
  const { id } = await params;

  const event = await prisma.historyEvent.findUnique({
    where: { id },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
  });
  if (!event || event.churchId !== staff.churchId) notFound();

  return (
    <>
      <PageHeader
        title={event.title}
        description={`${ymd(event.date)}${event.dateIsApprox ? " 무렵" : ""}`}
        back={{ href: "/history", label: "교회 역사" }}
        actions={
          <>
            <Link href={`/history/${event.id}/edit`} className="btn btn-ghost">
              수정
            </Link>
            <form action={deleteHistoryEvent.bind(null, event.id)}>
              <ConfirmSubmitButton
                message={`'${event.title}' 연혁을 삭제할까요? 첨부된 사진도 함께 삭제됩니다.`}
              >
                삭제
              </ConfirmSubmitButton>
            </form>
          </>
        }
      />

      <Card className="mb-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="primary">
            {HISTORY_CATEGORIES[event.category as HistoryCategory] ?? event.category}
          </Badge>
          {event.pinned && <Badge tone="accent">주요 연혁</Badge>}
        </div>
        {event.content ? (
          <p className="whitespace-pre-wrap text-[0.95rem] leading-[1.8] text-ink">
            {event.content}
          </p>
        ) : (
          <p className="text-sm text-ink-3">기록된 내용이 없습니다.</p>
        )}
      </Card>

      <Card>
        <CardTitle>사진 ({event.photos.length}장)</CardTitle>
        {event.photos.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">첨부된 사진이 없습니다.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {event.photos.map((p) => (
              <li key={p.id}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface-2"
                >
                  {/* 업로드된 사진은 임의 경로라 기본 img를 쓴다. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption ?? ""}
                    className="h-full w-full object-cover transition-transform hover:scale-[1.03]"
                  />
                </a>
                <div className="mt-1.5 flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-3">
                    {p.caption ?? ""}
                  </p>
                  <form action={deleteHistoryPhoto.bind(null, p.id)}>
                    <ConfirmSubmitButton
                      className="btn btn-quiet btn-sm shrink-0 text-expense"
                      message="이 사진을 삭제할까요?"
                    >
                      삭제
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <HistoryPhotoUploader
          eventId={event.id}
          remaining={MAX_HISTORY_PHOTOS - event.photos.length}
        />
      </Card>
    </>
  );
}
