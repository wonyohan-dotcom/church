"use client";

import { useActionState, useMemo, useState } from "react";
import { signup, type SignupState } from "@/actions/account";
import { SubmitButton } from "@/components/form";
import { IconCheck, IconSearch } from "@/components/icons";

type ChurchOption = { id: string; name: string; address: string | null };

export function SignupForm({ churches }: { churches: ChurchOption[] }) {
  const [state, formAction] = useActionState<SignupState, FormData>(signup, {});
  const [selected, setSelected] = useState<ChurchOption | null>(
    churches.length === 1 ? churches[0] : null,
  );
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return churches.slice(0, 6);
    return churches
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.address?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 20);
  }, [churches, query]);

  return (
    <form action={formAction} className="space-y-4">
      {/* 교회 선택 */}
      <div>
        <span className="label">출석 교회</span>
        {selected ? (
          <div className="flex items-center gap-2 rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5">
            <IconCheck width={17} height={17} className="shrink-0 text-income" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink">{selected.name}</span>
              {selected.address && (
                <span className="block truncate text-xs text-ink-3">{selected.address}</span>
              )}
            </span>
            <button
              type="button"
              className="btn btn-quiet btn-sm shrink-0"
              onClick={() => setSelected(null)}
            >
              변경
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <IconSearch
                width={17}
                height={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
              />
              <input
                type="text"
                className="field pl-9"
                placeholder="교회 이름으로 찾기"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
            </div>
            <ul className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-line">
              {matches.length === 0 ? (
                <li className="px-3 py-3 text-sm text-ink-3">
                  일치하는 교회가 없습니다.
                </li>
              ) : (
                matches.map((c) => (
                  <li key={c.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      className="w-full px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                      onClick={() => setSelected(c)}
                    >
                      <span className="block text-sm font-semibold text-ink">{c.name}</span>
                      {c.address && (
                        <span className="block truncate text-xs text-ink-3">{c.address}</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
        <input type="hidden" name="churchId" value={selected?.id ?? ""} />
      </div>

      <hr className="border-line" />

      <div>
        <label className="label" htmlFor="name">
          이름
        </label>
        <input
          id="name"
          name="name"
          className="field"
          placeholder="교회에 등록된 이름으로 적어 주세요"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="phone">
          연락처
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          className="field"
          placeholder="010-0000-0000"
        />
      </div>

      <div>
        <label className="label" htmlFor="loginId">
          아이디
        </label>
        <input
          id="loginId"
          name="loginId"
          className="field"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="영문·숫자 4자 이상"
          minLength={4}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="field"
          minLength={8}
          placeholder="8자 이상"
          required
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-expense-soft px-3 py-2.5 text-sm font-medium text-expense">
          {state.error}
        </p>
      )}

      <p className="rounded-xl bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-2">
        신청하시면 교회 관리자가 확인 후 승인해 드립니다. 승인되면 본인 헌금 내역과
        기부금영수증을 보실 수 있습니다.
      </p>

      <SubmitButton
        className="btn btn-primary w-full py-3"
        pendingLabel="신청 중…"
      >
        가입 신청하기
      </SubmitButton>
    </form>
  );
}
