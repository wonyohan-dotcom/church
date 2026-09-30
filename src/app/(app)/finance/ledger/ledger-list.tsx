"use client";

import Link from "next/link";
import { useState } from "react";
import { won } from "@/lib/format";
import { useGiverPicker } from "@/components/giver-picker";
import { IconCheck, IconUsers } from "@/components/icons";

export type LedgerRow = {
  id: string;
  kind: "IN" | "OUT";
  amount: number;
  account: string;
  who: string;
  memo: string | null;
  href: string;
  donorName: string | null;
  giverIds: string[];
};

export type LedgerDay = { key: string; label: string; in: number; out: number; rows: LedgerRow[] };

/**
 * 수입·지출 목록. '여러 건 선택'을 누르면 헌금 줄에 체크가 생기고,
 * 고른 헌금들의 헌금자를 한 번에 정할 수 있다 (예: '범준'으로 찾아 전체 선택 → 장범준·홍지성).
 */
export function LedgerList({ days, canEdit }: { days: LedgerDay[]; canEdit: boolean }) {
  const open = useGiverPicker();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const offerings = days.flatMap((d) => d.rows.filter((r) => r.kind === "IN"));
  const allPicked = offerings.length > 0 && offerings.every((r) => picked.has(r.id));
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const stop = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  const pickedRows = offerings.filter((r) => picked.has(r.id));
  const pickedSum = pickedRows.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      {canEdit && offerings.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          {selecting ? (
            <>
              <button
                type="button"
                onClick={() => setPicked(allPicked ? new Set() : new Set(offerings.map((r) => r.id)))}
                className="btn btn-ghost btn-sm"
              >
                {allPicked ? "선택 모두 풀기" : `헌금 전체 선택 (${offerings.length})`}
              </button>
              <button type="button" onClick={stop} className="btn btn-quiet btn-sm">
                취소
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-ink-3">여러 헌금의 헌금자를 한 번에 정할 수 있습니다.</span>
              <button type="button" onClick={() => setSelecting(true)} className="btn btn-ghost btn-sm shrink-0">
                <IconUsers width={15} height={15} />
                여러 건 선택
              </button>
            </>
          )}
        </div>
      )}

      <div className={`space-y-3 ${selecting ? "pb-24" : ""}`}>
        {days.map((d) => (
          <section key={d.key}>
            <div className="flex items-baseline justify-between gap-3 px-1 pb-1.5 text-sm">
              <span className="font-semibold text-ink-2">{d.label}</span>
              <span className="tnum text-xs">
                {d.in > 0 && <span className="text-income">+{won(d.in)}</span>}
                {d.in > 0 && d.out > 0 && <span className="text-ink-3"> · </span>}
                {d.out > 0 && <span className="text-expense">−{won(d.out)}</span>}
              </span>
            </div>
            <ul className="card divide-y divide-line">
              {d.rows.map((r) => {
                const body = (
                  <>
                    {selecting && r.kind === "IN" ? (
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-xl border-2 ${
                          picked.has(r.id) ? "border-primary bg-primary text-primary-ink" : "border-line-strong"
                        }`}
                      >
                        {picked.has(r.id) && <IconCheck width={18} height={18} />}
                      </span>
                    ) : (
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${
                          r.kind === "IN" ? "bg-income-soft text-income" : "bg-expense-soft text-expense"
                        }`}
                      >
                        {r.kind === "IN" ? "수입" : "지출"}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{r.account}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {[r.who, r.memo].filter(Boolean).join(" · ") || "-"}
                      </span>
                    </span>
                    <span className={`tnum shrink-0 text-sm font-semibold ${r.kind === "IN" ? "text-income" : "text-expense"}`}>
                      {r.kind === "IN" ? "+" : "−"}
                      {won(r.amount)}
                    </span>
                  </>
                );
                return (
                  <li key={`${r.kind}-${r.id}`} className={selecting && r.kind === "OUT" ? "opacity-40" : ""}>
                    {selecting ? (
                      <button
                        type="button"
                        disabled={r.kind === "OUT"}
                        onClick={() => toggle(r.id)}
                        className={`flex w-full items-center gap-3 p-3.5 text-left ${picked.has(r.id) ? "bg-primary-soft" : ""}`}
                      >
                        {body}
                      </button>
                    ) : (
                      <Link href={r.href} className="flex items-center gap-3 p-3.5 hover:bg-surface-2">
                        {body}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {selecting && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 px-4 lg:bottom-6 lg:left-64">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-bg shadow-2xl">
            <span className="min-w-0 flex-1 text-sm">
              <b>{picked.size}건</b> 선택
              {picked.size > 0 && <span className="tnum opacity-75"> · {won(pickedSum)}</span>}
            </span>
            <button
              type="button"
              disabled={picked.size === 0}
              className="btn btn-sm shrink-0 bg-[var(--accent-bright)] font-bold text-[#111] disabled:opacity-50"
              onClick={() =>
                open({
                  offeringId: pickedRows[0].id,
                  offeringIds: pickedRows.map((r) => r.id),
                  giverIds: pickedRows.every((r) => r.giverIds.join() === pickedRows[0].giverIds.join())
                    ? pickedRows[0].giverIds
                    : [],
                  title: `선택한 헌금 ${pickedRows.length}건 · 합계 ${won(pickedSum)}`,
                  writtenName: pickedRows.find((r) => r.donorName)?.donorName ?? null,
                  onSaved: stop,
                })
              }
            >
              헌금자 정하기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
