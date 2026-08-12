"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { SubmitButton } from "@/components/form";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div>
        <label className="label" htmlFor="loginId">
          아이디
        </label>
        <input
          id="loginId"
          name="loginId"
          className="field"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          placeholder="아이디를 입력하세요"
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
          autoComplete="current-password"
          required
          placeholder="비밀번호를 입력하세요"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-expense-soft px-3 py-2.5 text-sm font-medium text-expense">
          {state.error}
        </p>
      )}

      <SubmitButton className="btn btn-primary w-full py-3" pendingLabel="로그인 중…">
        로그인
      </SubmitButton>
    </form>
  );
}
