import { VISIT_KINDS, type VisitKind } from "@/lib/constants";
import { ymd } from "@/lib/format";
import { ConfirmSubmitButton } from "./form";

type VisitItem = {
  id: string;
  date: Date;
  kind: string;
  content: string;
  prayer: string | null;
  writer?: string | null;
  member?: { id: string; name: string; position: string | null } | null;
};

/** 심방·상담 기록 목록. 교인 상세와 심방 화면에서 함께 쓴다. */
export function VisitList({
  visits,
  onDelete,
  showMember = false,
}: {
  visits: VisitItem[];
  onDelete?: (id: string) => (formData: FormData) => void | Promise<void>;
  showMember?: boolean;
}) {
  if (visits.length === 0) {
    return <p className="py-2 text-sm text-ink-3">아직 기록이 없습니다.</p>;
  }
  return (
    <ol className="relative space-y-5 border-l border-line pl-5">
      {visits.map((v) => (
        <li key={v.id} className="relative">
          <span className="absolute -left-[1.62rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent-bright" />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
            <span className="tnum font-semibold text-ink-2">{ymd(v.date)}</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-ink-2">
              {VISIT_KINDS[v.kind as VisitKind] ?? v.kind}
            </span>
            {showMember && v.member && (
              <a href={`/members/${v.member.id}#visits`} className="font-semibold text-primary">
                {v.member.name} {v.member.position ?? ""}
              </a>
            )}
            {v.writer && <span>기록 {v.writer}</span>}
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">{v.content}</p>
          {v.prayer && (
            <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-sm leading-relaxed text-ink-2">
              <span className="mr-1.5 font-semibold text-accent">기도제목</span>
              {v.prayer}
            </p>
          )}
          {onDelete && (
            <form action={onDelete(v.id)} className="mt-1">
              <ConfirmSubmitButton className="text-xs text-ink-3 hover:text-expense" message="이 기록을 지울까요?">
                지우기
              </ConfirmSubmitButton>
            </form>
          )}
        </li>
      ))}
    </ol>
  );
}
