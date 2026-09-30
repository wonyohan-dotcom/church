"use client";

import { useRef, useState } from "react";
import { FIELD_LABELS } from "@/lib/import-rows";
import { IconDownload } from "./icons";

/** 엑셀 가져오기 화면에서 함께 쓰는 조각들 */

export function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-ink">
        {n}
      </span>
      <h2 className="text-[0.98rem] font-bold text-ink">{children}</h2>
    </div>
  );
}

export function FileDrop({
  onFile,
  disabled,
  fileName,
}: {
  onFile: (f: File) => void;
  disabled?: boolean;
  fileName?: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && !disabled) onFile(f);
      }}
      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-colors ${
        over ? "border-primary bg-primary-soft" : "border-line-strong bg-surface-2/60"
      }`}
    >
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <p className="text-sm font-semibold text-ink">
        {fileName ? fileName : "엑셀 파일을 여기에 끌어다 놓거나"}
      </p>
      <button
        type="button"
        className="btn btn-primary mt-3"
        onClick={() => input.current?.click()}
        disabled={disabled}
      >
        {fileName ? "다른 파일 고르기" : "파일 고르기"}
      </button>
      <p className="mt-2 text-xs text-ink-3">엑셀(.xlsx, .xls)과 CSV 를 읽을 수 있습니다.</p>
    </div>
  );
}

export function TemplateButton({ onClick, label = "빈 양식 내려받기" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={onClick}>
      <IconDownload width={16} height={16} />
      {label}
    </button>
  );
}

export function RecognizedColumns({ columns }: { columns: (keyof typeof FIELD_LABELS)[] }) {
  if (columns.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-ink-3">알아본 열</span>
      {columns.map((c) => (
        <span key={c} className="rounded-full bg-income-soft px-2 py-0.5 font-semibold text-income">
          {FIELD_LABELS[c]}
        </span>
      ))}
    </div>
  );
}

export function SkippedList({ items }: { items: { line: number; reason: string }[] }) {
  if (items.length === 0) return null;
  return (
    <details className="mt-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
      <summary className="cursor-pointer font-semibold">건너뛴 줄 {items.length}개 보기</summary>
      <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-xs">
        {items.map((s, i) => (
          <li key={`${s.line}-${i}`}>
            {s.line}번째 줄 — {s.reason}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** 여러 번에 나눠 서버에 보낸다(한 번에 너무 크면 요청 한도에 걸린다). */
export async function sendInChunks<T, R extends { created: number; skipped: { line: number; reason: string }[] }>(
  rows: T[],
  send: (chunk: T[]) => Promise<R>,
  onProgress: (done: number) => void,
  size = 200,
) {
  const total = { created: 0, skipped: [] as { line: number; reason: string }[], extra: [] as R[] };
  for (let i = 0; i < rows.length; i += size) {
    const r = await send(rows.slice(i, i + size));
    total.created += r.created;
    total.skipped.push(...r.skipped);
    total.extra.push(r);
    onProgress(Math.min(rows.length, i + size));
  }
  return total;
}
