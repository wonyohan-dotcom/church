"use client";

import type { Cell } from "./import-rows";

/**
 * 브라우저에서 엑셀(.xlsx, .xls)·CSV 파일을 표(행 × 열)로 읽는다.
 * 파일은 서버로 올라가지 않고, 알아본 내용만 확인 후 저장된다.
 *
 * xlsx 0.18.5 에는 "조작된 파일을 읽으면 안전하지 않다"는 알림이 있다.
 * 여기서는 교회 담당자가 자기 파일을 자기 브라우저에서만 읽으므로 영향이 없다.
 */
export async function readSheets(file: File): Promise<{ name: string; rows: Cell[][] }[]> {
  const XLSX = await import("xlsx");
  const buf = new Uint8Array(await file.arrayBuffer());

  let wb;
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    // 한글 CSV 는 EUC-KR 로 저장된 경우가 많다. UTF-8 로 안 읽히면 EUC-KR 로 읽는다.
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch {
      text = new TextDecoder("euc-kr").decode(buf);
    }
    wb = XLSX.read(text.replace(/^﻿/, ""), { type: "string", cellDates: true, raw: false });
  } else {
    wb = XLSX.read(buf, { type: "array", cellDates: true });
  }

  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: null }),
  })).filter((s) => s.rows.some((r) => r.some((c) => c !== null && c !== "")));
}

/** 양식 파일을 만들어 내려받게 한다. */
export async function downloadTemplate(fileName: string, rows: (string | number)[][], widths?: number[]) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (widths) ws["!cols"] = widths.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "입력");
  XLSX.writeFile(wb, fileName);
}
