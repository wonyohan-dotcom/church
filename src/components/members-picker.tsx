"use client";

import { useMemo, useRef, useState } from "react";
import { IconSearch, IconX } from "./icons";

export type PickableMemberLite = { id: string; name: string; position: string | null; code?: string };

/**
 * 여러 교인을 고르는 선택기 (연혁 참석자 등).
 * 이름 몇 글자로 찾아 눌러 담고, 담은 분은 위에 칩으로 보인다.
 * 폼에는 고른 교인 ID 를 쉼표로 이어 `name` 으로 보낸다.
 */
export function MembersPicker({
  members,
  name = "memberIds",
  defaultIds = [],
  label = "참석한 교인",
}: {
  members: PickableMemberLite[];
  name?: string;
  defaultIds?: string[];
  label?: string;
}) {
  const [ids, setIds] = useState<string[]>(defaultIds);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const matches = useMemo(() => {
    const q = query.replace(/\s/g, "");
    const chosen = new Set(ids);
    const pool = members.filter((m) => !chosen.has(m.id));
    return (q ? pool.filter((m) => m.name.replace(/\s/g, "").includes(q) || (m.code ?? "").includes(q)) : pool).slice(0, 40);
  }, [members, query, ids]);

  const add = (id: string) => setIds((s) => (s.includes(id) ? s : [...s, id]));
  const remove = (id: string) => setIds((s) => s.filter((x) => x !== id));

  return (
    <div ref={rootRef} className="scroll-mt-24">
      <span className="label">
        {label} <span className="tnum font-normal text-ink-3">{ids.length}명</span>
      </span>
      <input type="hidden" name={name} value={ids.join(",")} />

      {ids.length > 0 && (
        <ul className="mb-2.5 flex flex-wrap gap-1.5">
          {ids.map((id) => {
            const m = byId.get(id);
            if (!m) return null;
            return (
              <li key={id} className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-1 pl-3 pr-1.5 text-sm font-semibold text-primary-soft-ink">
                {m.name}
                <button type="button" onClick={() => remove(id)} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/15" aria-label={`${m.name} 빼기`}>
                  <IconX width={12} height={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="relative">
        <IconSearch width={17} height={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          type="text"
          className="field"
          style={{ paddingLeft: "2.25rem" }}
          placeholder="이름으로 찾아 눌러 담기"
          value={query}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setFocused(true);
            // 키보드가 올라온 뒤에 입력칸을 위로 올려, 아래 목록이 보이게 한다.
            setTimeout(() => rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 300);
          }}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
      </div>

      {(focused || query) && (
        <ul className="mt-2 max-h-52 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface py-1">
          {matches.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-ink-3">{query ? "일치하는 교인이 없습니다." : "더 담을 교인이 없습니다."}</li>
          ) : (
            matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-surface-2"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(m.id)}
                >
                  <span className="text-sm font-semibold text-ink">{m.name}</span>
                  <span className="text-xs text-ink-3">{m.position ?? "성도"}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
