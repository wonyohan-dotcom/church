"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { won } from "@/lib/format";
import { setGiversBulk } from "../../actions";
import { useGiverPicker } from "@/components/giver-picker";

export type NameGroup = {
  donorName: string;
  offeringIds: string[];
  total: number;
  /** 지금 이어진 교인 (모든 헌금이 같을 때만) */
  current: { id: string; name: string }[];
  /** 헌금마다 이어진 교인이 다르면 true */
  mixed: boolean;
  linkedCount: number;
  /** 이름으로 찾은 추천 교인 */
  suggested: { id: string; name: string }[];
};

/** 검색한 이름이 들어간 '적힌 이름' 묶음. 묶음마다 교인을 골라 한 번에 잇는다. */
export function NameGroups({ groups }: { groups: NameGroup[] }) {
  const open = useGiverPicker();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const applySuggested = (g: NameGroup) =>
    start(async () => {
      setBusy(g.donorName);
      await setGiversBulk(g.offeringIds, g.suggested.map((m) => m.id)).catch(() => null);
      setBusy(null);
      router.refresh();
    });

  return (
    <ul className="card divide-y divide-line">
      {groups.map((g) => {
        const sameAsSuggested =
          !g.mixed && g.suggested.length > 0 && g.suggested.map((m) => m.id).join() === g.current.map((m) => m.id).join();
        return (
          <li key={g.donorName} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">“{g.donorName}”</p>
                <p className="tnum mt-0.5 text-xs text-ink-3">
                  {g.offeringIds.length}건 · {won(g.total)}
                </p>
                <p className="mt-1 text-sm">
                  {g.mixed ? (
                    <span className="text-warn">헌금마다 이어진 교인이 다릅니다 ({g.linkedCount}건 연결됨)</span>
                  ) : g.current.length ? (
                    <span className="text-income">→ {g.current.map((m) => m.name).join(" · ")} 연결됨</span>
                  ) : (
                    <span className="text-ink-3">아직 교인과 이어지지 않음</span>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {g.suggested.length > 0 && !sameAsSuggested && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => applySuggested(g)}
                  className="btn btn-primary btn-sm"
                >
                  {busy === g.donorName ? "잇는 중…" : `${g.suggested.map((m) => m.name).join(" · ")} 님으로 잇기`}
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  open({
                    offeringId: g.offeringIds[0],
                    offeringIds: g.offeringIds,
                    giverIds: g.mixed ? g.suggested.map((m) => m.id) : g.current.length ? g.current.map((m) => m.id) : g.suggested.map((m) => m.id),
                    title: `“${g.donorName}” 헌금 ${g.offeringIds.length}건 · ${won(g.total)}`,
                    writtenName: g.donorName,
                  })
                }
              >
                {g.suggested.length > 0 || g.current.length ? "다른 교인 고르기" : "교인 고르기"}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
