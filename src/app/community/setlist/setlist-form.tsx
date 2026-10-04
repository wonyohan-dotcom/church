import Link from "next/link";
import { SubmitButton } from "@/components/form";
import { saveSetlist } from "../actions";

const ERRORS: Record<string, string> = {
  required: "제목과 날짜를 입력해 주세요.",
  songs: "곡을 한 줄에 하나씩 적거나, 유튜브 재생목록 주소를 넣어 주세요.",
  playlist: "재생목록 주소가 올바르지 않습니다. 유튜브 재생목록 링크(list= 가 들어 있는 주소)를 넣어 주세요.",
};

export function SetlistForm({
  initial,
  error,
}: {
  initial: { id?: string; title: string; date: string; note: string; playlistUrl: string; songs: string };
  error?: string;
}) {
  return (
    <form action={saveSetlist} className="card space-y-4 p-5">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {error && ERRORS[error] && <p className="rounded-xl bg-expense-soft px-3 py-2.5 text-sm font-medium text-expense">{ERRORS[error]}</p>}

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">제목</span>
        <input name="title" className="field w-full" defaultValue={initial.title} placeholder="예) 10월 11일 주일예배 콘티" maxLength={80} required />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">예배 날짜</span>
        <input name="serviceDate" type="date" className="field w-full" defaultValue={initial.date} required />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">곡 목록</span>
        <textarea
          name="songs"
          className="field min-h-44 w-full font-[inherit] leading-relaxed"
          defaultValue={initial.songs}
          placeholder={"한 줄에 곡 하나씩, 제목 · 키 · 유튜브 링크 순서로 적어 주세요.\n\n주님 사랑해요 G https://youtu.be/xxxxxxxxxxx\n나의 마음 | Bb | https://youtu.be/yyyyyyyyyyy"}
        />
        <span className="mt-1 block text-xs leading-relaxed text-ink-3">
          링크를 붙여 넣은 곡은 위에서부터 이어서 재생되는 플레이어가 자동으로 만들어집니다. 링크가 없는 곡은 제목만 보입니다.
        </span>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">유튜브 재생목록 주소 (선택)</span>
        <input name="playlistUrl" className="field w-full" defaultValue={initial.playlistUrl} placeholder="이미 만들어 둔 재생목록이 있으면 그 주소" inputMode="url" />
        <span className="mt-1 block text-xs text-ink-3">넣으면 곡 링크 대신 이 재생목록이 플레이어로 나옵니다.</span>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">메모 (선택)</span>
        <textarea name="note" className="field min-h-20 w-full" defaultValue={initial.note} maxLength={500} placeholder="예) 찬양 연습은 토요일 3시" />
      </label>

      <div className="flex justify-end gap-2">
        <Link href="/community/setlist" className="btn btn-ghost">
          취소
        </Link>
        <SubmitButton>저장하기</SubmitButton>
      </div>
    </form>
  );
}
