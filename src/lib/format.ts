const KRW = new Intl.NumberFormat("ko-KR");

export function won(n: number | null | undefined): string {
  if (n === null || n === undefined) return "0원";
  return `${KRW.format(n)}원`;
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "0";
  return KRW.format(n);
}

export function ymd(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}. ${pad(date.getMonth() + 1)}. ${pad(date.getDate())}`;
}

export function ymdDash(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function ym(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** 만 나이 */
export function age(birth: Date | string | null | undefined): number | null {
  if (!birth) return null;
  const b = typeof birth === "string" ? new Date(birth) : birth;
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

export function phone(v: string | null | undefined): string {
  if (!v) return "-";
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}

/** 날짜 문자열(yyyy-mm-dd)을 로컬 자정 Date로. 빈 값이면 null. */
export function parseDate(v: FormDataEntryValue | null | undefined): Date | null {
  if (!v || typeof v !== "string" || !v.trim()) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseIntOr(v: FormDataEntryValue | null | undefined, fallback = 0): number {
  if (typeof v !== "string") return fallback;
  const n = Number(v.replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

export function str(v: FormDataEntryValue | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}
