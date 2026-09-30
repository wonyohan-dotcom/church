"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { parseFinanceSheet, normHeader, type Cell, type FinanceImportRow } from "@/lib/import-rows";
import { downloadTemplate, readSheets } from "@/lib/read-sheet";
import { won } from "@/lib/format";
import {
  FileDrop,
  RecognizedColumns,
  SkippedList,
  StepTitle,
  TemplateButton,
  sendInChunks,
} from "@/components/import-parts";
import { importFinance } from "./actions";

const TEMPLATE = [
  ["날짜", "구분", "항목", "금액", "이름", "거래처", "적요", "방법"],
  ["2026-01-04", "수입", "주일헌금", 50000, "홍길동", "", "", "현금"],
  ["2026-01-04", "수입", "십일조", 300000, "김은혜", "", "", "계좌이체"],
  ["2026-01-05", "지출", "공과금", 123450, "", "한국전력", "1월 전기요금", "계좌이체"],
];

type Sheet = { name: string; rows: Cell[][] };

export function FinanceImporter({
  accounts,
  memberNames,
}: {
  accounts: { name: string; type: "INCOME" | "EXPENSE" }[];
  memberNames: string[];
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [defaultDirection, setDefaultDirection] = useState<"IN" | "OUT" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<{
    created: number;
    skipped: { line: number; reason: string }[];
    newAccounts: string[];
  } | null>(null);

  const parsed = useMemo(
    () => (sheets[sheetIndex] ? parseFinanceSheet(sheets[sheetIndex].rows, { accounts, defaultDirection }) : null),
    [sheets, sheetIndex, accounts, defaultDirection],
  );

  const summary = useMemo(() => {
    if (!parsed) return null;
    const known = new Set(accounts.map((a) => `${a.type}|${normHeader(a.name)}`));
    const members = new Map<string, number>();
    for (const n of memberNames) members.set(n, (members.get(n) ?? 0) + 1);
    const inRows = parsed.rows.filter((r) => r.direction === "IN");
    const outRows = parsed.rows.filter((r) => r.direction === "OUT");
    const newAcc = new Set<string>();
    for (const r of parsed.rows) {
      const type = r.direction === "IN" ? "INCOME" : "EXPENSE";
      const name = r.account ?? (r.direction === "IN" ? "기타수입" : "기타지출");
      if (!known.has(`${type}|${normHeader(name)}`)) newAcc.add(`${r.direction === "IN" ? "수입" : "지출"} · ${name}`);
    }
    return {
      inCount: inRows.length,
      inSum: inRows.reduce((s, r) => s + r.amount, 0),
      outCount: outRows.length,
      outSum: outRows.reduce((s, r) => s + r.amount, 0),
      linked: inRows.filter((r) => r.name && members.get(r.name.replace(/\s/g, "")) === 1).length,
      newAccounts: [...newAcc],
      needsDirection: parsed.skipped.some((s) => s.reason.startsWith("수입인지")),
    };
  }, [parsed, accounts, memberNames]);

  async function onFile(f: File) {
    setError(null);
    setDone(null);
    setFileName(f.name);
    try {
      const s = await readSheets(f);
      if (s.length === 0) throw new Error("빈 파일입니다.");
      const first = s.findIndex((x) => parseFinanceSheet(x.rows, { accounts }).rows.length > 0);
      setSheets(s);
      setSheetIndex(Math.max(0, first));
    } catch (e) {
      setSheets([]);
      setError(`파일을 읽지 못했습니다. ${e instanceof Error ? e.message : ""}`);
    }
  }

  async function save(rows: FinanceImportRow[]) {
    setSaving(true);
    setProgress(0);
    setError(null);
    try {
      const r = await sendInChunks(rows, (chunk) => importFinance(chunk), setProgress);
      setDone({
        created: r.created,
        skipped: [...(parsed?.skipped ?? []), ...r.skipped],
        newAccounts: [...new Set(r.extra.flatMap((x) => x.newAccounts))],
      });
      setSheets([]);
      setFileName(null);
    } catch (e) {
      setError(`저장하다가 멈췄습니다: ${e instanceof Error ? e.message : ""} 이미 들어간 줄은 다시 올려도 두 번 입력되지 않습니다.`);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="card p-6">
        <p className="title-serif text-xl text-ink">
          <span className="tnum">{done.created}</span>건을 장부에 입력했습니다.
        </p>
        {done.newAccounts.length > 0 && (
          <p className="mt-2 text-sm text-ink-2">
            새로 만든 항목: {done.newAccounts.join(", ")}.{" "}
            <Link href="/finance/accounts" className="text-primary underline">
              계정과목
            </Link>
            에서 이름이나 기부금영수증 포함 여부를 고칠 수 있습니다.
          </p>
        )}
        <SkippedList items={done.skipped} />
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/finance" className="btn btn-primary">
            회계 화면 보기
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => setDone(null)}>
            다른 파일 더 올리기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <StepTitle n={1}>엑셀 파일 고르기</StepTitle>
        <p className="mb-4 text-sm leading-relaxed text-ink-2">
          지금 쓰시는 재정 장부 엑셀을 그대로 올려 보세요. <b>날짜</b>와 <b>금액</b>(또는 수입·지출 열)만 있으면
          항목, 헌금자 이름, 적요, 거래처를 알아서 찾습니다. 합계 줄은 건너뜁니다.
        </p>
        <FileDrop onFile={onFile} disabled={saving} fileName={fileName} />
        <div className="mt-3 flex justify-end">
          <TemplateButton
            onClick={() => downloadTemplate("수입지출_양식.xlsx", TEMPLATE, [12, 6, 12, 12, 10, 14, 20, 10])}
          />
        </div>
        {error && <p className="mt-3 text-sm text-expense">{error}</p>}
      </div>

      {parsed && summary && (
        <div className="card p-5">
          <StepTitle n={2}>확인하고 저장</StepTitle>
          {sheets.length > 1 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-3">시트</span>
              {sheets.map((s, i) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setSheetIndex(i)}
                  className={`rounded-full px-3 py-1 font-semibold ${i === sheetIndex ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-2"}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          <RecognizedColumns columns={parsed.columns} />

          {summary.needsDirection && (
            <div className="mt-3 rounded-xl bg-warn-soft p-3 text-sm text-warn">
              <p className="font-semibold">수입인지 지출인지 적힌 열이 없는 줄이 있습니다. 이 파일은…</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDefaultDirection("IN")}>
                  모두 수입(헌금)
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDefaultDirection("OUT")}>
                  모두 지출
                </button>
              </div>
            </div>
          )}

          {parsed.rows.length === 0 ? (
            <p className="mt-3 text-sm text-expense">
              이 시트에서 수입·지출 내역을 찾지 못했습니다. 위쪽에 &lsquo;날짜&rsquo;(또는 &lsquo;일자&rsquo;)와
              &lsquo;금액&rsquo; 제목이 있는지 확인해 주세요.
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-income-soft p-4">
                  <p className="text-xs font-semibold text-income">수입</p>
                  <p className="tnum mt-1 text-lg font-bold text-income">
                    {summary.inCount}건 · {won(summary.inSum)}
                  </p>
                  {summary.inCount > 0 && (
                    <p className="mt-1 text-xs text-ink-2">교인과 연결되는 헌금 {summary.linked}건 (기부금영수증에 반영)</p>
                  )}
                </div>
                <div className="rounded-xl bg-expense-soft p-4">
                  <p className="text-xs font-semibold text-expense">지출</p>
                  <p className="tnum mt-1 text-lg font-bold text-expense">
                    {summary.outCount}건 · {won(summary.outSum)}
                  </p>
                </div>
              </div>
              {summary.newAccounts.length > 0 && (
                <p className="mt-3 text-sm text-ink-2">
                  처음 보는 항목은 새로 만듭니다: <b>{summary.newAccounts.join(", ")}</b>
                </p>
              )}

              <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                <table className="table text-sm">
                  <thead>
                    <tr>
                      <th>줄</th>
                      <th>날짜</th>
                      <th>구분</th>
                      <th>항목</th>
                      <th className="text-right">금액</th>
                      <th>이름·거래처</th>
                      <th>적요</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 30).map((r, i) => (
                      <tr key={`${r.line}-${i}`}>
                        <td className="tnum text-ink-3">{r.line}</td>
                        <td className="tnum whitespace-nowrap">{r.date}</td>
                        <td className={r.direction === "IN" ? "text-income" : "text-expense"}>
                          {r.direction === "IN" ? "수입" : "지출"}
                        </td>
                        <td>{r.account ?? (r.direction === "IN" ? "기타수입" : "기타지출")}</td>
                        <td className="tnum whitespace-nowrap text-right font-semibold">{won(r.amount)}</td>
                        <td>{(r.direction === "IN" ? r.name : (r.payee ?? r.name)) ?? "-"}</td>
                        <td className="max-w-[14rem] truncate">{r.description ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.rows.length > 30 && (
                <p className="mt-2 text-xs text-ink-3">처음 30줄만 보여 드립니다. 저장하면 {parsed.rows.length}줄 모두 들어갑니다.</p>
              )}
              <SkippedList items={parsed.skipped} />
              <p className="mt-4 text-xs text-ink-3">
                같은 날짜·금액·항목·이름의 기록이 이미 있으면 건너뜁니다. 같은 파일을 두 번 올려도 두 번 입력되지 않습니다.
              </p>
              <div className="mt-4 flex justify-end">
                <button type="button" className="btn btn-primary" disabled={saving} onClick={() => save(parsed.rows)}>
                  {saving ? `저장 중… (${progress}/${parsed.rows.length})` : `${parsed.rows.length}건 장부에 입력하기`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
