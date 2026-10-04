"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ABSENCE_REASONS, SERVICES } from "@/lib/constants";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { SubmitButton } from "@/components/form";
import { IconCheck, IconMore, IconSearch, IconX } from "@/components/icons";

type Person = {
  id: string;
  name: string;
  position: string | null;
  inactive: boolean;
  district: string | null;
  districtOrder: number;
};

type Absence = { reason: string; note: string };
type Visitor = { key: number; name: string; note: string };

const NO_DISTRICT = "교구 없음";

/**
 * 출석부.
 * - 이름을 누를 때마다 출석 표시가 켜지고 꺼진다.
 * - 이름 옆 ⋯ 를 누르면 그 사람의 사유 결석(아파서 등)을 남길 수 있다.
 * - 교적에 없는 방문자·새가족은 이름과 메모를 적는다.
 * - "한눈에 보기"로 출석·결석 사유·방문자를 모아서 본다.
 * 저장할 때 모든 표시를 한 번에 보낸다.
 */
export function AttendanceSheet({
  action,
  date,
  service,
  members,
  initialChecked,
  initialAbsences,
  initialVisitorList,
  initialUnnamed,
  initialNote,
  exists,
}: {
  action: (formData: FormData) => void | Promise<void>;
  date: string;
  service: string;
  members: Person[];
  initialChecked: string[];
  initialAbsences: Array<{ memberId: string; reason: string; note: string }>;
  initialVisitorList: Array<{ name: string; note: string }>;
  initialUnnamed: number;
  initialNote: string;
  exists: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(() => new Set(initialChecked));
  const [absent, setAbsent] = useState<Record<string, Absence>>(() =>
    Object.fromEntries(initialAbsences.map((a) => [a.memberId, { reason: a.reason, note: a.note }])),
  );
  const [visitors, setVisitors] = useState<Visitor[]>(() =>
    initialVisitorList.map((v, i) => ({ key: i, name: v.name, note: v.note })),
  );
  const [nextKey, setNextKey] = useState(initialVisitorList.length);
  const [unnamed, setUnnamed] = useState(initialUnnamed);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [reasonFor, setReasonFor] = useState<Person | null>(null);
  const [summary, setSummary] = useState(false);

  function go(next: { date?: string; service?: string }) {
    const params = new URLSearchParams({ date: next.date ?? date, service: next.service ?? service });
    router.push(`/attendance/check?${params}`);
  }

  function clearAbsence(id: string) {
    setAbsent((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  /** 이름을 누르면 출석 ↔ 해제 (사유 결석이던 분은 출석으로 바뀐다) */
  function toggle(id: string) {
    clearAbsence(id);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id) && !(id in absent)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function mark(id: string, kind: "present" | "absent" | "none", absence?: Absence) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (kind === "present") next.add(id);
      else next.delete(id);
      return next;
    });
    if (kind === "absent" && absence) setAbsent((prev) => ({ ...prev, [id]: absence }));
    else clearAbsence(id);
  }

  const groups = useMemo(() => {
    const q = query.trim();
    const list = members.filter(
      (m) =>
        (showInactive || !m.inactive || checked.has(m.id) || m.id in absent) &&
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
  }, [members, query, showInactive, checked, absent]);

  const inactiveCount = members.filter((m) => m.inactive).length;
  const namedVisitors = visitors.filter((v) => v.name.trim());
  const visitorTotal = namedVisitors.length + unnamed;
  const absentCount = Object.keys(absent).length;

  function setGroup(people: Person[], on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const p of people) {
        if (on) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
    if (on) for (const p of people) clearAbsence(p.id);
  }

  const absencesJson = JSON.stringify(
    Object.entries(absent).map(([memberId, a]) => ({ memberId, reason: a.reason, note: a.note })),
  );
  const visitorsJson = JSON.stringify(namedVisitors.map((v) => ({ name: v.name.trim(), note: v.note.trim() })));

  return (
    <form action={action} className="pb-28 lg:pb-0">
      <input type="hidden" name="memberIds" value={[...checked].join(",")} />
      <input type="hidden" name="absences" value={absencesJson} />
      <input type="hidden" name="visitors" value={visitorsJson} />
      <input type="hidden" name="visitorCount" value={unnamed} />

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
          <select id="service" name="service" className="field" value={service} onChange={(e) => go({ service: e.target.value })}>
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
            <IconSearch width={17} height={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
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
        <p className="mb-4 text-sm text-ink-3">이 날짜의 출석부는 아직 없습니다. 표시하고 저장하면 새로 만들어집니다.</p>
      )}

      {members.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-3">등록된 교인이 없습니다. 교인을 먼저 등록해 주세요.</div>
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
                  <button type="button" className="text-xs font-semibold text-primary" onClick={() => setGroup(g.people, on < g.people.length)}>
                    {on < g.people.length ? "모두 출석" : "모두 해제"}
                  </button>
                </div>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {g.people.map((p) => {
                    const isOn = checked.has(p.id);
                    const ab = absent[p.id];
                    return (
                      <li key={p.id} className="relative">
                        <button
                          type="button"
                          aria-pressed={isOn}
                          onClick={() => toggle(p.id)}
                          className={`flex w-full items-center gap-2.5 rounded-xl border py-2.5 pl-3 pr-10 text-left transition-colors ${
                            ab
                              ? "border-warn bg-warn-soft"
                              : isOn
                                ? "border-primary bg-primary-soft"
                                : "border-line bg-surface hover:bg-surface-2"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                              ab ? "border-warn bg-warn text-white" : isOn ? "border-primary bg-primary text-primary-ink" : "border-line-strong"
                            }`}
                          >
                            {ab ? <span className="text-[0.7rem] font-extrabold leading-none">결</span> : isOn && <IconCheck width={14} height={14} strokeWidth={2.6} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[0.95rem] font-semibold text-ink">{p.name}</span>
                            <span className={`block truncate text-[0.72rem] ${ab ? "font-semibold text-warn" : "text-ink-3"}`}>
                              {ab ? ab.reason + (ab.note ? ` · ${ab.note}` : "") : `${p.position ?? "성도"}${p.inactive ? " · 장기결석" : ""}`}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setReasonFor(p)}
                          aria-label={`${p.name} 사유 남기기`}
                          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 hover:bg-surface-3"
                        >
                          <IconMore width={18} height={18} />
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
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              장기결석 교인 {inactiveCount}명도 보기
            </label>
          )}
        </div>
      )}

      {/* 방문자 · 새가족 */}
      <section className="card mt-5 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[0.98rem] font-bold text-ink">
            방문자 · 새가족 <span className="tnum font-medium text-ink-3">{visitorTotal}명</span>
          </h2>
        </div>
        {visitors.length > 0 && (
          <ul className="mb-3 space-y-2.5">
            {visitors.map((v) => (
              <li key={v.key} className="flex items-start gap-2">
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[10rem_1fr]">
                  <input
                    className="field"
                    placeholder="이름"
                    value={v.name}
                    maxLength={40}
                    onChange={(e) => setVisitors((list) => list.map((x) => (x.key === v.key ? { ...x, name: e.target.value } : x)))}
                  />
                  <input
                    className="field"
                    placeholder="메모 (누구 소개, 연락처 등)"
                    value={v.note}
                    maxLength={200}
                    onChange={(e) => setVisitors((list) => list.map((x) => (x.key === v.key ? { ...x, note: e.target.value } : x)))}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-quiet h-11 w-11 shrink-0 p-0"
                  aria-label="이 방문자 지우기"
                  onClick={() => setVisitors((list) => list.filter((x) => x.key !== v.key))}
                >
                  <IconX width={16} height={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => {
            setVisitors((list) => [...list, { key: nextKey, name: "", note: "" }]);
            setNextKey((k) => k + 1);
          }}
        >
          + 방문자 이름 적기
        </button>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <div>
            <p className="text-sm font-semibold text-ink">이름 없이 인원만</p>
            <p className="text-xs text-ink-3">이름을 모르는 방문자는 숫자로만 더합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost h-11 w-11 p-0 text-lg" onClick={() => setUnnamed((v) => Math.max(0, v - 1))} aria-label="한 명 빼기">
              −
            </button>
            <span className="tnum w-8 text-center text-[1.05rem] font-bold">{unnamed}</span>
            <button type="button" className="btn btn-ghost h-11 w-11 p-0 text-lg" onClick={() => setUnnamed((v) => v + 1)} aria-label="한 명 더하기">
              +
            </button>
          </div>
        </div>
      </section>

      <div className="card mt-4 p-4">
        <label className="label" htmlFor="note">
          메모
        </label>
        <input id="note" name="note" className="field" defaultValue={initialNote} placeholder="예) 성찬 주일, 폭설" />
      </div>

      {/* 휴대폰에서는 아래 탭 바로 위에 붙어 있는 저장 줄 */}
      <div className="fixed inset-x-0 bottom-[calc(3.9rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:static lg:mt-5 lg:rounded-2xl lg:border lg:bg-surface lg:px-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <button type="button" onClick={() => setSummary(true)} className="min-w-0 text-left" aria-label="한눈에 보기">
            <p className="text-sm text-ink-2">
              <b className="tnum text-[1.05rem] text-ink">{checked.size + visitorTotal}</b>명 출석
              <span className="text-ink-3">
                {" "}
                (교인 <span className="tnum">{checked.size}</span> · 방문 <span className="tnum">{visitorTotal}</span>
                {absentCount > 0 && (
                  <>
                    {" "}
                    · 사유 결석 <span className="tnum">{absentCount}</span>
                  </>
                )}
                )
              </span>
            </p>
            <p className="text-xs font-semibold text-primary">한눈에 보기 ›</p>
          </button>
          <SubmitButton pendingLabel="저장 중…">출석 저장</SubmitButton>
        </div>
      </div>

      {reasonFor && (
        <ReasonSheet
          person={reasonFor}
          present={checked.has(reasonFor.id)}
          absence={absent[reasonFor.id]}
          onClose={() => setReasonFor(null)}
          onApply={(kind, absence) => {
            mark(reasonFor.id, kind, absence);
            setReasonFor(null);
          }}
        />
      )}

      {summary && (
        <SummarySheet
          date={date}
          service={service}
          members={members}
          checked={checked}
          absent={absent}
          visitors={namedVisitors}
          unnamed={unnamed}
          onClose={() => setSummary(false)}
        />
      )}
    </form>
  );
}

/* ── 바닥에서 올라오는 창의 공통 틀 ── */

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const kb = useKeyboardInset();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div style={{ paddingBottom: kb.gap }} className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      <div
        style={kb.height ? { maxHeight: Math.min(kb.height - 16, window.innerHeight * 0.9) } : undefined}
        className="relative flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl"
      >
        <div className="border-b border-line px-4 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-surface-3 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-base font-bold text-ink">{title}</p>
            <button type="button" onClick={onClose} className="btn btn-quiet btn-sm -mr-2" aria-label="닫기">
              <IconX width={18} height={18} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ── 한 사람: 출석 / 사유 결석 / 표시 없음 ── */

function ReasonSheet({
  person,
  present,
  absence,
  onClose,
  onApply,
}: {
  person: Person;
  present: boolean;
  absence?: Absence;
  onClose: () => void;
  onApply: (kind: "present" | "absent" | "none", absence?: Absence) => void;
}) {
  const [kind, setKind] = useState<"present" | "absent" | "none">(absence ? "absent" : present ? "present" : "absent");
  const [reason, setReason] = useState(absence?.reason ?? "");
  const [note, setNote] = useState(absence?.note ?? "");
  const options = [
    { v: "present", label: "출석" },
    { v: "absent", label: "결석 사유" },
    { v: "none", label: "표시 없음" },
  ] as const;

  return (
    <Sheet title={`${person.name}${person.position ? ` ${person.position}` : ""}`} onClose={onClose}>
      <div className="flex rounded-xl bg-surface-2 p-1 text-sm font-semibold">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setKind(o.v)}
            className={`flex-1 rounded-lg py-2 ${kind === o.v ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink-3"}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {kind === "absent" && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-ink">왜 못 오셨나요?</p>
          <div className="flex flex-wrap gap-2">
            {ABSENCE_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${
                  reason === r ? "border-warn bg-warn-soft text-warn" : "border-line bg-surface text-ink-2"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            className="field mt-3"
            placeholder="자세한 내용 (선택) 예) 독감, 병원 입원"
            value={note}
            maxLength={100}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary mt-5 w-full"
        disabled={kind === "absent" && !reason}
        onClick={() => onApply(kind, kind === "absent" ? { reason, note: note.trim() } : undefined)}
      >
        {kind === "absent" && !reason ? "사유를 골라 주세요" : "적용"}
      </button>
    </Sheet>
  );
}

/* ── 한눈에 보기 ── */

function SummarySheet({
  date,
  service,
  members,
  checked,
  absent,
  visitors,
  unnamed,
  onClose,
}: {
  date: string;
  service: string;
  members: Person[];
  checked: Set<string>;
  absent: Record<string, Absence>;
  visitors: Visitor[];
  unnamed: number;
  onClose: () => void;
}) {
  const present = members.filter((m) => checked.has(m.id));
  const absentees = members.filter((m) => m.id in absent);
  const unmarked = members.filter((m) => !checked.has(m.id) && !(m.id in absent) && !m.inactive);
  const byDistrict = new Map<string, Person[]>();
  for (const m of present) {
    const k = m.district ?? NO_DISTRICT;
    byDistrict.set(k, [...(byDistrict.get(k) ?? []), m]);
  }
  const total = present.length + visitors.length + unnamed;
  const label = SERVICES[service as keyof typeof SERVICES] ?? service;

  return (
    <Sheet title={`${date.replaceAll("-", ". ")} ${label}`} onClose={onClose}>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { n: total, l: "총 출석", c: "text-primary" },
          { n: present.length, l: "교인", c: "text-ink" },
          { n: visitors.length + unnamed, l: "방문", c: "text-ink" },
          { n: absentees.length, l: "사유 결석", c: "text-warn" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl bg-surface-2 px-1 py-2.5">
            <p className={`tnum text-[1.3rem] font-extrabold leading-none ${s.c}`}>{s.n}</p>
            <p className="mt-1 text-[0.7rem] font-semibold text-ink-3">{s.l}</p>
          </div>
        ))}
      </div>

      <SummaryBlock title="출석" count={present.length}>
        {present.length === 0 ? (
          <p className="text-sm text-ink-3">아직 표시한 분이 없습니다.</p>
        ) : (
          [...byDistrict.entries()].map(([d, people]) => (
            <div key={d} className="mb-2.5 last:mb-0">
              <p className="mb-1 text-xs font-bold text-ink-3">{d}</p>
              <p className="flex flex-wrap gap-1.5">
                {people.map((p) => (
                  <span key={p.id} className="rounded-lg bg-primary-soft px-2.5 py-1 text-sm font-semibold text-primary-soft-ink">
                    {p.name}
                  </span>
                ))}
              </p>
            </div>
          ))
        )}
      </SummaryBlock>

      {absentees.length > 0 && (
        <SummaryBlock title="사유 결석" count={absentees.length}>
          <ul className="space-y-2">
            {absentees.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-bold text-ink">{p.name}</span>
                <span className="min-w-0 text-right text-warn">
                  {absent[p.id].reason}
                  {absent[p.id].note ? ` · ${absent[p.id].note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </SummaryBlock>
      )}

      {(visitors.length > 0 || unnamed > 0) && (
        <SummaryBlock title="방문자 · 새가족" count={visitors.length + unnamed}>
          <ul className="space-y-2">
            {visitors.map((v) => (
              <li key={v.key} className="text-sm">
                <span className="font-bold text-ink">{v.name}</span>
                {v.note && <span className="ml-2 text-ink-3">{v.note}</span>}
              </li>
            ))}
            {unnamed > 0 && <li className="text-sm text-ink-3">이름 없이 {unnamed}명</li>}
          </ul>
        </SummaryBlock>
      )}

      {unmarked.length > 0 && (
        <SummaryBlock title="표시 안 한 분" count={unmarked.length} muted>
          <p className="flex flex-wrap gap-1.5">
            {unmarked.map((p) => (
              <span key={p.id} className="rounded-lg bg-surface-2 px-2.5 py-1 text-sm text-ink-2">
                {p.name}
              </span>
            ))}
          </p>
        </SummaryBlock>
      )}
    </Sheet>
  );
}

function SummaryBlock({ title, count, muted, children }: { title: string; count: number; muted?: boolean; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className={`mb-2 text-sm font-extrabold ${muted ? "text-ink-3" : "text-ink"}`}>
        {title} <span className="tnum font-semibold text-ink-3">{count}</span>
      </h3>
      {children}
    </section>
  );
}
