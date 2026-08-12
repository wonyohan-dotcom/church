"use client";

import { useActionState } from "react";
import { registerChurch, type RegisterState } from "@/actions/account";
import { SubmitButton } from "@/components/form";

export function RegisterChurchForm() {
  const [state, formAction] = useActionState<RegisterState, FormData>(registerChurch, {});

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="churchName">
          교회 이름
        </label>
        <input
          id="churchName"
          name="churchName"
          className="field"
          placeholder="예) 은혜교회"
          required
          autoFocus
        />
      </div>

      <hr className="border-line" />
      <p className="text-xs font-semibold text-ink-3">관리자 계정</p>

      <div>
        <label className="label" htmlFor="name">
          이름
        </label>
        <input id="name" name="name" className="field" placeholder="예) 홍길동" required />
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

      <SubmitButton className="btn btn-primary w-full py-3" pendingLabel="등록 중…">
        교회 등록하고 시작하기
      </SubmitButton>
    </form>
  );
}
