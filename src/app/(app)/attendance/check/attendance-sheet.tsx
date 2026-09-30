"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SERVICES } from "@/lib/constants";
import { SubmitButton } from "@/components/form";
import { IconCheck, IconSearch } from "@/components/icons";

type Person = {
  id: string;
  name: string;
  position: string | null;
  inactive: boolean;
  district: string | null;
  districtOrder: number;
};

const NO_DISTRICT = "교구 없음";

/**
 * 출석부. 이름을 누를 때마다 표시가 켜지고 꺼진다.
 * 교구별로 묶어 보여주고, 이름 몇 글자로 바로 찾을 수 있다.
 * 저장할 때 체크한 교인 ID 를 한 번에 보낸다.
 */
export function AttendanceSheet({
  action,
  date,
  service,
  members,
  initialChecked,
  initialVisitors,
  initialNote,
  exists,
}: {
  action: (formData: FormData) => void | Promise<void>;
  date: string;
  service: string;
  members: Person[];
  initialChecked: string[];
  initialVisitors: number;
  initialNote: string;
  exists: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(() => new Set(initialChecked));
  const [query, setQuery] = useState("");
  const [visitors, setVisitors] = useState(initialVisitors);
  const [showInactive, setShowInactive] = useState(false);

  function go(next: { date?: string; service?: string }) {
    const params = new URLSearchParams({ date: next.date ?? date, service: next.service ?? service });
    router.push(`/attendance/check?${params}`);
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const groups = useMemo(() => {
    const q = query.trim();
    const list = members.filter(
      (m) =>
        (showInactive || !m.inactive || checked.has(m.id)) &&
        (!q || m.name.includes(q) || (m.district ?? "").includes(q)),
    );
    const map = new Map<string, { order: number; people: Person[] }>();
    for (const m of list) {
      const key = m.district ?? NO_DISTRICT;
      const g = map.get(key) ?? { order: m.district ? m.districtOrder : 99999, people: [] };
      g.people.push(m);
      map.set(key, g);
    }
    return [...map.entries()].sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]));
  }, [members, query, showInactive, checked]);

  const inactiveCount = members.filter((m) => m.inactive).length;

  function setGroup(people: Person[], on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const p of people) {
        if (on) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  }

  return (
    <form action={action} className="pb-24 lg:pb-0">
      <input type="hidden" name="memberIds" value={[...checked].join(",")} />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_1.4fr]">
        <div>
          <label className="label" htmlFor="date">
            날짜
          </label>
          <input
            id="date"
            type="date"
            name="date"
            className="field"
            value={date}
            onChange={(e) => e.target.value && go({ date: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="service">
            예배·모임
          </label>
          <select
            id="service"
            name="service"
            className="field"
            value={service}
            onChange={(e) => go({ service: e.target.value })}
          >
            {Object.entries(SERVICES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="q">
            이름으로 찾기
          </label>
          <div className="relative">
            <IconSearch
              width={17}
              height={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              id="q"
              className="field pl-9"
              placeholder="예) 김은"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {!exists && (
        <p className="mb-4 text-sm text-ink-3">
          이 날짜의 출석부는 아직 없습니다. 표시하고 저장하면 새로 만들어집니다.
        </p>
      )}

      {members.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-3">
          등록된 교인이 없습니다. 교인을 먼저 등록해 주세요.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([name, g]) => {
            const on = g.people.filter((p) => checked.has(p.id)).length;
            return (
              <section key={name}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-sm font-bold text-ink">
                    {name} <span className="tnum font-medium text-ink-3">{on}/{g.people.length}</span>
                  </p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary"
                    onClick={() => setGroup(g.people, on < g.people.length)}
                  >
                    {on < g.people.length ? "모두 출석" : "모두 해제"}
                  </button>
                </div>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {g.people.map((p) => {
                    const isOn = checked.has(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          aria-pressed={isOn}
                          onClick={() => toggle(p.id)}
                          className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                            isOn
                              ? "border-primary bg-primary-soft"
                              : "border-line bg-surface hover:bg-surface-2"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                              isOn ? "border-primary bg-primary text-primary-ink" : "border-line-strong"
                            }`}
                          >
                            {isOn && <IconCheck width={14} height={14} strokeWidth={2.6} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[0.95rem] font-semibold text-ink">
                              {p.name}
                            </span>
                            <span className="block truncate text-[0.72rem] text-ink-3">
                              {p.position ?? "성도"}
                              {p.inactive ? " · 장기결석" : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {inactiveCount > 0 && (
            <label className="flex items-center gap-2 px-1 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              장기결석 교인 {inactiveCount}명도 보기
            </label>
          )}
        </div>
      )}

      <div className="card mt-5 grid gap-4 p-4 sm:grid-cols-[14rem_1fr]">
        <div>
          <span className="label">교적에 없는 방문자</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost h-11 w-11 p-0 text-lg"
              onClick={() => setVisitors((v) => Math.max(0, v - 1))}
              aria-label="방문자 한 명 빼기"
            >
              −
            </button>
            <input
              name="visitorCount"
              inputMode="numeric"
              className="field tnum text-center"
              value={visitors}
              onChange={(e) => setVisitors(Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0))}
            />
            <button
              type="button"
              className="btn btn-ghost h-11 w-11 p-0 text-lg"
              onClick={() => setVisitors((v) => v + 1)}
              aria-label="방문자 한 명 더하기"
            >
              +
            </button>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="note">
            메모
          </label>
          <input id="note" name="note" className="field" defaultValue={initialNote} placeholder="예) 성찬 주일, 폭설" />
        </div>
      </div>

      {/* 휴대폰에서는 아래 탭 바로 위에 붙어 있는 저장 줄 */}
      <div className="fixed inset-x-0 bottom-[calc(3.9rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:static lg:mt-5 lg:rounded-2xl lg:border lg:bg-surface lg:px-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="text-sm text-ink-2">
            <b className="tnum text-[1.05rem] text-ink">{checked.size + visitors}</b>명 출석
            <span className="text-ink-3">
              {" "}
              (교인 <span className="tnum">{checked.size}</span> · 방문 <span className="tnum">{visitors}</span>)
            </span>
          </p>
          <SubmitButton pendingLabel="저장 중…">출석 저장</SubmitButton>
        </div>
      </div>
    </form>
  );
}
