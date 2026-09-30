"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { matchGivers } from "@/lib/givers";
import { setGiversBulk, setOfferingGivers } from "@/app/(app)/finance/actions";
import { IconCheck, IconSearch, IconX } from "./icons";

/**
 * 헌금자 고르기
 *  - 헌금 줄을 꾹 누르면(컴퓨터는 오른쪽 클릭) 교인을 고르는 창이 뜬다.
 *  - 여러 분을 고르면 함께 드린 헌금이 되어 모두의 헌금 내역에 보인다. 맨 앞 분이 대표.
 *  - 적힌 이름(예: "김동진최창일")에서 찾은 교인은 맨 위에 추천으로 보여준다.
 * 교인 목록은 화면에 한 번만 싣고(Provider), 줄마다 여는 방법만 둔다.
 */

export type PickerMember = { id: string; name: string; sub?: string | null };

type Target = {
  offeringId: string;
  /** 여러 헌금을 한꺼번에 정할 때 (검색 결과에서 여러 건 선택) */
  offeringIds?: string[];
  giverIds: string[];
  /** 창 위에 보여줄 설명 (예: "9월 21일 · 감사헌금 · 50,000원") */
  title: string;
  /** 통장·엑셀에 적힌 이름 */
  writtenName: string | null;
  /** 저장한 뒤 할 일 (여러 건 선택을 풀기 등) */
  onSaved?: () => void;
};

const Ctx = createContext<((t: Target) => void) | null>(null);

export function GiverPickerProvider({
  members,
  children,
}: {
  members: PickerMember[];
  children: ReactNode;
}) {
  const [target, setTarget] = useState<Target | null>(null);
  return (
    <Ctx.Provider value={setTarget}>
      {children}
      {target && (
        <PickerSheet
          key={target.offeringId}
          target={target}
          members={members}
          onClose={() => setTarget(null)}
        />
      )}
    </Ctx.Provider>
  );
}

export function useGiverPicker() {
  return useOpen();
}

function useOpen() {
  const open = useContext(Ctx);
  if (!open) throw new Error("GiverPickerProvider 안에서 써야 합니다.");
  return open;
}

/** 꾹 누르면 헌금자 고르기, 그냥 누르면 href 로 이동하는 줄 */
export function GiverPress({
  href,
  className,
  children,
  ...target
}: Target & { href?: string; className?: string; children: ReactNode }) {
  const open = useOpen();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  const fire = () => {
    fired.current = true;
    cancel();
    navigator.vibrate?.(12);
    open(target);
  };

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(fire, 450);
    },
    onPointerMove: (e: React.PointerEvent) => {
      // 스크롤하려고 움직이면 꾹 누르기가 아니다.
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) {
        cancel();
      }
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClick: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        fired.current = false;
      }
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      if (!fired.current) fire();
    },
    // 아이폰에서 꾹 누를 때 뜨는 링크 미리보기·글자 선택을 막는다.
    style: { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } as const,
  };

  return href ? (
    <Link href={href} className={className} {...handlers}>
      {children}
    </Link>
  ) : (
    <div role="button" tabIndex={0} className={className} {...handlers}>
      {children}
    </div>
  );
}

/** 눌러서 헌금자 고르기 (컴퓨터 표의 헌금자 칸) */
export function GiverButton({
  className,
  children,
  ...target
}: Target & { className?: string; children: ReactNode }) {
  const open = useOpen();
  return (
    <button type="button" className={className} onClick={() => open(target)} title="헌금자 고르기">
      {children}
    </button>
  );
}

function PickerSheet({
  target,
  members,
  onClose,
}: {
  target: Target;
  members: PickerMember[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(target.giverIds);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const suggested = useMemo(
    () => matchGivers(target.writtenName, members).filter((id) => byId.has(id)),
    [target.writtenName, members, byId],
  );

  const list = useMemo(() => {
    const term = q.replace(/\s/g, "");
    if (term) return members.filter((m) => m.name.replace(/\s/g, "").includes(term)).slice(0, 80);
    // 검색 전: 추천 → 이미 고른 분 → 나머지(가나다순)
    const top = [...suggested, ...selected.filter((id) => !suggested.includes(id))];
    const rest = members.filter((m) => !top.includes(m.id));
    return [...top.map((id) => byId.get(id)!).filter(Boolean), ...rest].slice(0, 200);
  }, [q, members, suggested, selected, byId]);

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

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const save = (ids: string[]) =>
    startTransition(async () => {
      setError(null);
      const r = await (target.offeringIds
        ? setGiversBulk(target.offeringIds, ids)
        : setOfferingGivers(target.offeringId, ids)
      ).catch(() => ({ ok: false }));
      if (!r.ok) {
        setError("저장하지 못했습니다. 잠시 뒤 다시 해 주세요.");
        return;
      }
      router.refresh();
      target.onSaved?.();
      onClose();
    });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="헌금자 고르기">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      <div className="relative flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl">
        <div className="border-b border-line px-4 pb-3 pt-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-surface-3 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-bold text-ink">
                {target.offeringIds ? `헌금 ${target.offeringIds.length}건, 누가 드렸나요?` : "누가 드린 헌금인가요?"}
              </p>
              <p className="tnum mt-0.5 truncate text-xs text-ink-3">{target.title}</p>
              {target.writtenName && (
                <p className="mt-0.5 truncate text-xs text-ink-3">적힌 이름: “{target.writtenName}”</p>
              )}
            </div>
            <button type="button" onClick={onClose} className="btn btn-quiet btn-sm -mr-2" aria-label="닫기">
              <IconX width={18} height={18} />
            </button>
          </div>

          {selected.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selected.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-sm font-semibold text-primary-soft-ink"
                >
                  {i === 0 && selected.length > 1 && <span className="text-[0.7rem] opacity-70">대표</span>}
                  {byId.get(id)?.name ?? "?"}
                  <IconX width={12} height={12} />
                </button>
              ))}
            </div>
          )}

          <label className="relative mt-3 block">
            <IconSearch width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="교인 이름 검색"
              className="field" style={{ paddingLeft: "2.3rem" }}
              enterKeyHint="search"
            />
          </label>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1">
          {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-3">찾는 교인이 없습니다.</li>}
          {list.map((m) => {
            const on = selected.includes(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${on ? "bg-primary-soft" : "hover:bg-surface-2"}`}
                >
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-md border ${on ? "border-primary bg-primary text-primary-ink" : "border-line-strong"}`}
                  >
                    {on && <IconCheck width={13} height={13} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-ink">{m.name}</span>
                    {m.sub && <span className="ml-1.5 text-xs text-ink-3">{m.sub}</span>}
                  </span>
                  {!q && suggested.includes(m.id) && (
                    <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[0.7rem] font-semibold text-accent">
                      이름 일치
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-line px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {error && <p className="mb-2 text-sm text-expense">{error}</p>}
          <p className="mb-2 text-xs text-ink-3">
            여러 분을 고르면 함께 드린 헌금으로 모두의 내역에 보입니다. 기부금영수증은 대표에게 들어갑니다.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => save([])}>
              무명으로
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1"
              disabled={pending}
              onClick={() => save(selected)}
            >
              {pending ? "저장 중…" : selected.length ? `${selected.length}명으로 저장` : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
