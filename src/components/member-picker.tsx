"use client";

import { useMemo, useRef, useState } from "react";
import { IconSearch, IconX } from "./icons";

export type PickableMember = {
  id: string;
  name: string;
  code: string;
  position: string | null;
  districtName: string | null;
};

/**
 * 이름을 몇 글자만 쳐도 후보가 좁혀지는 교인 선택기.
 * 실제로 폼에 실려 가는 값은 숨김 input의 교인 ID다.
 */
export function MemberPicker({
  members,
  name = "memberId",
  defaultMember,
  label = "헌금하신 교인",
  hint,
}: {
  members: PickableMember[];
  name?: string;
  defaultMember?: PickableMember | null;
  label?: string;
  hint?: string;
}) {
  const [selected, setSelected] = useState<PickableMember | null>(defaultMember ?? null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members.slice(0, 8);
    return members
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.code.includes(q) ||
          (m.districtName?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 20);
  }, [members, query]);

  if (selected) {
    return (
      <div>
        <span className="label">{label}</span>
        <input type="hidden" name={name} value={selected.id} />
        <div className="flex items-center gap-2 rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="font-semibold text-ink">{selected.name}</span>
            <span className="tnum ml-2 text-xs text-ink-3">
              {selected.code}
              {selected.position ? ` · ${selected.position}` : ""}
            </span>
          </span>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => {
              setSelected(null);
              setQuery("");
            }}
            aria-label="선택 해제"
          >
            <IconX width={16} height={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <span className="label">{label}</span>
      <div className="relative">
        <IconSearch
          width={17}
          height={17}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
        />
        <input
          type="text"
          className="field pl-9"
          placeholder="이름 또는 교적번호로 찾기"
          value={query}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // 목록 항목을 누르는 동안 창이 닫히지 않도록 잠깐 늦춘다.
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
        />
      </div>

      {open && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-[var(--shadow-lg)]">
          {matches.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-ink-3">일치하는 교인이 없습니다.</li>
          ) : (
            matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                    setSelected(m);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{m.name}</span>
                    <span className="tnum block text-xs text-ink-3">
                      {m.code}
                      {m.position ? ` · ${m.position}` : ""}
                      {m.districtName ? ` · ${m.districtName}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      <p className="mt-1 text-xs text-ink-3">
        {hint ?? "교인으로 등록되지 않은 분은 아래 '헌금자 이름'에 직접 적어 주세요."}
      </p>
    </div>
  );
}
