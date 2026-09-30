"use client";

import { useState } from "react";

/** 글자를 클립보드에 복사하는 버튼. 복사가 막힌 브라우저에서는 직접 고를 수 있게 안내한다. */
export function CopyButton({
  text,
  label = "복사",
  className = "btn btn-ghost btn-sm",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("done");
        } catch {
          setState("fail");
        }
        setTimeout(() => setState("idle"), 2500);
      }}
    >
      {state === "done" ? "복사됨 ✓" : state === "fail" ? "길게 눌러 직접 복사하세요" : label}
    </button>
  );
}
