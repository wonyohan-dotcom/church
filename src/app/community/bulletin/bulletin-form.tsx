import Link from "next/link";
import { SubmitButton } from "@/components/form";
import { saveBulletin } from "../actions";

const ERRORS: Record<string, string> = {
  required: "예배 날짜를 입력해 주세요.",
  empty: "내용을 한 칸 이상 적어 주세요.",
  playlist: "재생목록 주소가 올바르지 않습니다. 유튜브 재생목록 링크(list= 가 들어 있는 주소)를 넣어 주세요.",
};

export type BulletinInitial = {
  id?: string;
  title: string;
  date: string;
  sermonTitle: string;
  scripture: string;
  worshipOrder: string;
  songs: string;
  playlistUrl: string;
  announcements: string;
  prayers: string;
  note: string;
};

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-5">
      <div>
        <h2 className="text-[1.02rem] font-extrabold tracking-[-0.03em] text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function BulletinForm({ initial, error }: { initial: BulletinInitial; error?: string }) {
  return (
    <form action={saveBulletin} className="space-y-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {error && ERRORS[error] && (
        <p className="rounded-xl bg-expense-soft px-4 py-3 text-sm font-medium text-expense">{ERRORS[error]}</p>
      )}

      <Group title="이번 주 예배" hint="비워 둔 칸은 성도 화면에 나타나지 않습니다.">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">예배 날짜</span>
          <input name="serviceDate" type="date" className="field w-full" defaultValue={initial.date} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">설교 제목</span>
          <input name="sermonTitle" className="field w-full" defaultValue={initial.sermonTitle} maxLength={120} placeholder="예) 은혜 안에서 자라가는 교회" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">본문 말씀</span>
          <input name="scripture" className="field w-full" defaultValue={initial.scripture} maxLength={120} placeholder="예) 에베소서 4:11-16" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">주보 이름 (선택)</span>
          <input name="title" className="field w-full" defaultValue={initial.title} maxLength={80} placeholder="주일 예배 주보" />
        </label>
      </Group>

      <Group title="예배 순서" hint="한 줄에 하나씩. 담당이나 내용은 | 뒤에 적어 주세요.">
        <textarea
          name="worshipOrder"
          rows={7}
          className="field w-full leading-relaxed"
          defaultValue={initial.worshipOrder}
          placeholder={"묵도\n찬송 | 다 같이\n대표 기도 | 김장로\n말씀 | 원요한 목사\n봉헌 기도\n축도"}
        />
      </Group>

      <Group title="찬양" hint="곡을 한 줄에 하나씩 — 제목, 키, 유튜브 링크 순서. 링크를 붙인 곡은 위에서부터 이어서 재생됩니다.">
        <textarea
          name="songs"
          rows={6}
          className="field w-full leading-relaxed"
          defaultValue={initial.songs}
          placeholder={"주님 사랑해요 G https://youtu.be/xxxxxxxxxxx\n나의 마음 | Bb | https://youtu.be/yyyyyyyyyyy\n링크 없는 곡"}
        />
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">유튜브 재생목록 주소 (선택)</span>
          <input name="playlistUrl" className="field w-full" defaultValue={initial.playlistUrl} placeholder="이미 만들어 둔 재생목록이 있으면 그 주소" inputMode="url" />
          <span className="mt-1 block text-xs text-ink-3">넣으면 곡 링크 대신 이 재생목록이 플레이어로 나옵니다.</span>
        </label>
      </Group>

      <Group title="광고" hint="이번 주 알림 사항. 한 줄에 하나씩.">
        <textarea
          name="announcements"
          rows={6}
          className="field w-full leading-relaxed"
          defaultValue={initial.announcements}
          placeholder={"예배 후 12시 30분에 교육관에서 함께 식사합니다.\n새가족 환영회: 다음 주일 오후 1시\n청년부 수련회 신청을 받습니다."}
        />
      </Group>

      <Group title="기도 제목" hint="함께 기도할 제목. 한 줄에 하나씩.">
        <textarea
          name="prayers"
          rows={5}
          className="field w-full leading-relaxed"
          defaultValue={initial.prayers}
          placeholder={"아픈 성도들의 회복을 위해\n새로 오신 가정이 교회에 잘 정착하도록\n다음 세대가 믿음 안에서 자라도록"}
        />
      </Group>

      <Group title="메모 (선택)">
        <textarea name="note" rows={3} className="field w-full" defaultValue={initial.note} maxLength={500} placeholder="표지에 함께 보일 한마디. 예) 찬양 연습은 토요일 오후 3시" />
      </Group>

      <div className="flex justify-end gap-2">
        <Link href="/community/bulletin" className="btn btn-ghost">
          취소
        </Link>
        <SubmitButton>저장하기</SubmitButton>
      </div>
    </form>
  );
}
