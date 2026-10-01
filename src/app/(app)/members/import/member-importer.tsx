"use client";

import { useState } from "react";
import Link from "next/link";
import { parseMemberSheet, type Cell, type MemberImportRow } from "@/lib/import-rows";
import { downloadTemplate, readSheets } from "@/lib/read-sheet";
import { MEMBER_STATUS } from "@/lib/constants";
import {
  FileDrop,
  RecognizedColumns,
  SkippedList,
  StepTitle,
  TemplateButton,
  sendInChunks,
} from "@/components/import-parts";
import { importMembers } from "./actions";

const TEMPLATE = [
  ["이름", "성별", "생년월일", "휴대폰", "이메일", "주소", "상세주소", "직분", "교구", "등록일", "세례일", "직업", "메모"],
  ["홍길동", "남", "1970-05-12", "010-1234-5678", "", "서울시 도봉구 ○○로 12", "101동 1001호", "집사", "1교구", "2015-03-01", "2016-04-17", "회사원", ""],
];

type Sheet = { name: string; rows: Cell[][] };

export function MemberImporter() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<{ created: number; skipped: { line: number; reason: string }[] } | null>(null);

  const parsed = sheets[sheetIndex] ? parseMemberSheet(sheets[sheetIndex].rows) : null;

  async function onFile(f: File) {
    setError(null);
    setDone(null);
    setFileName(f.name);
    try {
      const s = await readSheets(f);
      if (s.length === 0) throw new Error("빈 파일입니다.");
      // 이름 열이 있는 첫 시트를 고른다
      const first = s.findIndex((x) => parseMemberSheet(x.rows).rows.length > 0);
      setSheets(s);
      setSheetIndex(Math.max(0, first));
    } catch (e) {
      setSheets([]);
      setError(`파일을 읽지 못했습니다. ${e instanceof Error ? e.message : ""}`);
    }
  }

  async function save(rows: MemberImportRow[]) {
    setSaving(true);
    setProgress(0);
    setError(null);
    try {
      const r = await sendInChunks(rows, (chunk) => importMembers(chunk), setProgress);
      setDone({ created: r.created, skipped: [...(parsed?.skipped ?? []), ...r.skipped] });
      setSheets([]);
      setFileName(null);
    } catch (e) {
      setError(`저장하다가 멈췄습니다: ${e instanceof Error ? e.message : ""} 이미 저장된 분은 다시 올려도 두 번 등록되지 않습니다.`);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="card p-6">
        <p className="title text-xl text-ink">
          <span className="tnum">{done.created}</span>명을 등록했습니다.
        </p>
        <p className="mt-1 text-sm text-ink-3">교구·구역 이름이 처음 보는 것이면 새로 만들어 연결했습니다.</p>
        <SkippedList items={done.skipped} />
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/members" className="btn btn-primary">
            교인 목록 보기
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
          지금 쓰고 계신 교적 엑셀을 그대로 올려 보세요. 첫 줄에 <b>이름·성명</b> 같은 제목이 있으면
          휴대폰, 생년월일, 주소, 직분, 교구 같은 열을 알아서 찾습니다. 양식을 새로 만드시려면 빈 양식을
          받아 채워 주세요.
        </p>
        <FileDrop onFile={onFile} disabled={saving} fileName={fileName} />
        <div className="mt-3 flex justify-end">
          <TemplateButton
            onClick={() => downloadTemplate("교인등록_양식.xlsx", TEMPLATE, [10, 6, 12, 15, 20, 28, 16, 8, 8, 12, 12, 10, 20])}
          />
        </div>
        {error && <p className="mt-3 text-sm text-expense">{error}</p>}
      </div>

      {parsed && (
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

          {parsed.rows.length === 0 ? (
            <p className="text-sm text-expense">
              이 시트에서 교인 명단을 찾지 못했습니다. 첫 줄(또는 위쪽 몇 줄 안)에 &lsquo;이름&rsquo; 또는
              &lsquo;성명&rsquo; 제목이 있는지 확인해 주세요.
            </p>
          ) : (
            <>
              <RecognizedColumns columns={parsed.columns} />
              <p className="mt-3 text-sm text-ink-2">
                <b className="tnum text-ink">{parsed.rows.length}</b>명을 찾았습니다. 아래에서 몇 분만 확인해 보세요.
              </p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-line">
                <table className="table text-sm">
                  <thead>
                    <tr>
                      <th>줄</th>
                      <th>이름</th>
                      <th>성별</th>
                      <th>생년월일</th>
                      <th>휴대폰</th>
                      <th>직분</th>
                      <th>교구</th>
                      <th>상태</th>
                      <th>주소</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 30).map((r) => (
                      <tr key={r.line}>
                        <td className="tnum text-ink-3">{r.line}</td>
                        <td className="font-semibold text-ink">{r.name}</td>
                        <td>{r.gender === "M" ? "남" : r.gender === "F" ? "여" : "-"}</td>
                        <td className="tnum whitespace-nowrap">
                          {r.birthDate ?? "-"}
                          {r.birthIsLunar ? " (음)" : ""}
                        </td>
                        <td className="tnum whitespace-nowrap">{r.phone ?? "-"}</td>
                        <td>{r.position ?? "-"}</td>
                        <td>{r.district ?? "-"}</td>
                        <td>{MEMBER_STATUS[r.status]}</td>
                        <td className="max-w-[16rem] truncate">{[r.address, r.addressDetail].filter(Boolean).join(" ") || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.rows.length > 30 && (
                <p className="mt-2 text-xs text-ink-3">처음 30명만 보여 드립니다. 저장하면 {parsed.rows.length}명 모두 들어갑니다.</p>
              )}
              <SkippedList items={parsed.skipped} />
              <p className="mt-4 text-xs text-ink-3">
                이름과 휴대폰(또는 생년월일)이 같은 교인이 이미 있으면 같은 분으로 보고 건너뜁니다. 같은 파일을
                두 번 올려도 두 번 등록되지 않습니다.
              </p>
              <div className="mt-4 flex justify-end">
                <button type="button" className="btn btn-primary" disabled={saving} onClick={() => save(parsed.rows)}>
                  {saving ? `저장 중… (${progress}/${parsed.rows.length})` : `${parsed.rows.length}명 등록하기`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
