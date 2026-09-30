/**
 * 엑셀·CSV 에서 읽은 표(행 × 열)를 교인 명단과 수입·지출 내역으로 바꾼다.
 *
 * 교회마다 엑셀 모양이 제각각이라 열 이름을 넓게 알아본다.
 * ("이름"·"성명"·"성도명", "휴대폰"·"연락처"·"핸드폰" …)
 * 머리글이 첫 줄이 아니어도(제목 줄이 위에 있어도) 찾아낸다.
 *
 * 브라우저에서 미리보기를 만들 때와 서버에서 저장하기 전 다시 검사할 때
 * 똑같이 쓰도록 순수 함수만 둔다.
 */

export type Cell = string | number | boolean | Date | null | undefined;

/** 비교용으로 머리글을 다듬는다: 공백·괄호·기호 제거 */
export function normHeader(v: Cell): string {
  return String(v ?? "")
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/[\s·.:_\-/*]/g, "")
    .toLowerCase();
}

type FieldSpec<K extends string> = Record<K, string[]>;

export const MEMBER_FIELDS = {
  name: ["이름", "성명", "성도명", "교인명", "성도", "name"],
  gender: ["성별", "남녀", "gender"],
  birthDate: ["생년월일", "생일", "출생일", "생년", "birthday", "birth"],
  phone: ["휴대폰", "핸드폰", "휴대전화", "연락처", "전화", "전화번호", "휴대폰번호", "phone", "mobile"],
  email: ["이메일", "메일", "email"],
  postalCode: ["우편번호", "우편"],
  address: ["주소", "집주소", "address"],
  addressDetail: ["상세주소", "나머지주소"],
  position: ["직분", "직책", "직위"],
  district: ["교구", "구역", "목장", "속회", "교구구역", "소속"],
  status: ["상태", "구분", "교적상태"],
  registeredAt: ["등록일", "등록일자", "교회등록일"],
  catechumenAt: ["학습", "학습일"],
  baptizedAt: ["세례", "세례일", "유아세례"],
  confirmedAt: ["입교", "입교일"],
  job: ["직업", "직장"],
  note: ["메모", "비고", "특이사항", "기타"],
} satisfies FieldSpec<string>;
export type MemberField = keyof typeof MEMBER_FIELDS;

export const FINANCE_FIELDS = {
  date: ["날짜", "일자", "거래일", "거래일자", "헌금일", "지출일", "년월일", "date"],
  kind: ["구분", "수입지출", "입출", "입출금", "종류"],
  amount: ["금액", "액수", "금액원", "amount"],
  income: ["수입", "수입금액", "입금", "입금액", "헌금액"],
  expense: ["지출", "지출금액", "출금", "출금액", "사용금액"],
  account: ["항목", "계정", "계정과목", "과목", "헌금종류", "헌금항목", "지출항목", "분류", "세목"],
  /** 항목을 묶는 큰 분류(헌금, 운영비, 사역비 …). 새 항목을 만들 때 그 분류로 넣는다. */
  category: ["대분류", "계정분류", "관"],
  name: ["이름", "성명", "헌금자", "헌금인", "교인", "보낸분", "보내는분", "입금자", "입금자명"],
  payee: ["거래처", "지급처", "사용처", "받는분", "상호"],
  description: ["적요", "거래내용", "내용", "내역", "사용내역", "비고", "메모"],
  method: ["방법", "결제방법", "납부방법", "수단"],
} satisfies FieldSpec<string>;
export type FinanceField = keyof typeof FINANCE_FIELDS;

/**
 * 머리글 줄에서 각 항목이 몇 번째 열인지 찾는다.
 * 먼저 정확히 같은 이름을 모든 열에서 찾고, 남은 열만 "포함" 관계로 본다.
 * ("집전화" 가 먼저 나와도 "휴대폰" 열이 전화번호 자리를 차지하도록)
 */
export function mapHeaders<K extends string>(row: Cell[], spec: FieldSpec<K>): Partial<Record<K, number>> {
  const keys = Object.keys(spec) as K[];
  const heads = row.map(normHeader);
  const map: Partial<Record<K, number>> = {};
  const usedCols = new Set<number>();

  for (const k of keys) {
    const i = heads.findIndex((h, idx) => !usedCols.has(idx) && h && spec[k].some((s) => normHeader(s) === h));
    if (i >= 0) {
      map[k] = i;
      usedCols.add(i);
    }
  }
  heads.forEach((h, i) => {
    if (!h || usedCols.has(i)) return;
    const k = keys.find(
      (k) => map[k] === undefined && spec[k].some((s) => normHeader(s).length >= 2 && h.includes(normHeader(s))),
    );
    if (k) {
      map[k] = i;
      usedCols.add(i);
    }
  });
  return map;
}

/** 위에서 15줄 안에서 알아볼 수 있는 머리글이 가장 많은 줄을 머리글로 본다. */
export function findHeaderRow<K extends string>(rows: Cell[][], spec: FieldSpec<K>, required: NoInfer<K>) {
  let best = { index: -1, map: {} as Partial<Record<K, number>>, score: 0 };
  rows.slice(0, 15).forEach((row, index) => {
    const map = mapHeaders(row, spec);
    const score = Object.keys(map).length;
    if (map[required] !== undefined && score > best.score) best = { index, map, score };
  });
  return best;
}

/* ── 값 다듬기 ─────────────────────────── */

const pad = (n: number) => String(n).padStart(2, "0");

function ymdOf(y: number, m: number, d: number): string | null {
  if (y < 100) y += y > 30 ? 1900 : 2000;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  if (y < 1900 || y > 2100) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 여러 모양의 날짜를 yyyy-mm-dd 로. 음력 표시((음), 음력)가 있으면 lunar=true */
export function toDate(v: Cell): { value: string | null; lunar: boolean } {
  if (v === null || v === undefined || v === "") return { value: null, lunar: false };
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return { value: null, lunar: false };
    // 엑셀 날짜는 시각 없이 저장되지만, 읽는 쪽 시간대 때문에 몇 시간 어긋날 수 있어 반올림한다.
    const t = new Date(v.getTime() + 12 * 3600 * 1000);
    return { value: ymdOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()), lunar: false };
  }
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) {
      // 엑셀 날짜 일련번호 (1900 날짜 체계)
      const t = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
      return { value: ymdOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()), lunar: false };
    }
    if (v >= 19000101 && v <= 21001231) {
      const s = String(Math.round(v));
      return { value: ymdOf(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8)), lunar: false };
    }
    return { value: null, lunar: false };
  }
  const s = String(v).trim();
  const lunar = /음/.test(s);
  let m = /(\d{4}|\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(s);
  if (m) return { value: ymdOf(+m[1], +m[2], +m[3]), lunar };
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s.replace(/\D/g, "").length === 8 ? s.replace(/\D/g, "") : "");
  if (m) return { value: ymdOf(+m[1], +m[2], +m[3]), lunar };
  m = /^(\d{2})(\d{2})(\d{2})$/.exec(s.replace(/\D/g, "").length === 6 ? s.replace(/\D/g, "") : "");
  if (m) return { value: ymdOf(+m[1], +m[2], +m[3]), lunar };
  return { value: null, lunar };
}

/** "50,000원", "₩50,000", 50000 → 50000. 괄호나 앞의 - 는 음수. */
export function toAmount(v: Cell): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  const s = String(v).trim();
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  const digits = s.replace(/[^\d.]/g, "");
  if (!digits) return null;
  const n = Math.round(Number(digits));
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

export function toText(v: Cell): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return toDate(v).value;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 500) : null;
}

/** 전화번호를 숫자만 남겨 010-1234-5678 모양으로 */
export function toPhone(v: Cell): string | null {
  const raw = toText(v);
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  // 엑셀이 앞자리 0 을 지워 10자리(1012345678)가 된 경우
  if (d.length === 10 && d.startsWith("1")) d = `0${d}`;
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return d.startsWith("02") ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

export function toGender(v: Cell): "M" | "F" | null {
  const s = toText(v);
  if (!s) return null;
  if (/^(남|m|male|남자|남성)/i.test(s)) return "M";
  if (/^(여|f|female|여자|여성)/i.test(s)) return "F";
  return null;
}

export function toStatus(v: Cell): "ACTIVE" | "INACTIVE" | "TRANSFERRED" | "DECEASED" {
  const s = toText(v) ?? "";
  if (/장기|결석|휴면/.test(s)) return "INACTIVE";
  if (/이명|전출|이적/.test(s)) return "TRANSFERRED";
  if (/소천|별세|사망/.test(s)) return "DECEASED";
  return "ACTIVE";
}

export function toDirection(v: Cell): "IN" | "OUT" | null {
  const s = toText(v) ?? "";
  if (/수입|입금|헌금|수납|in/i.test(s)) return "IN";
  if (/지출|출금|지급|사용|out/i.test(s)) return "OUT";
  return null;
}

export function toMethod(v: Cell): "CASH" | "TRANSFER" | "CARD" | "OTHER" | null {
  const s = toText(v) ?? "";
  if (!s) return null;
  if (/현금/.test(s)) return "CASH";
  if (/이체|계좌|송금|온라인|무통장/.test(s)) return "TRANSFER";
  if (/카드/.test(s)) return "CARD";
  return "OTHER";
}

const isBlankRow = (row: Cell[]) => row.every((c) => c === null || c === undefined || String(c).trim() === "");
/** 합계·소계 줄은 건너뛴다 */
const isTotalRow = (row: Cell[]) =>
  row.some((c) => typeof c === "string" && /^(합\s*계|총\s*계|소\s*계|누\s*계|total)$/i.test(c.trim()));

/* ── 교인 명단 ──────────────────────────── */

export type MemberImportRow = {
  line: number;
  name: string;
  gender: "M" | "F" | null;
  birthDate: string | null;
  birthIsLunar: boolean;
  phone: string | null;
  email: string | null;
  postalCode: string | null;
  address: string | null;
  addressDetail: string | null;
  position: string | null;
  district: string | null;
  status: "ACTIVE" | "INACTIVE" | "TRANSFERRED" | "DECEASED";
  registeredAt: string | null;
  catechumenAt: string | null;
  baptizedAt: string | null;
  confirmedAt: string | null;
  job: string | null;
  note: string | null;
};

export type SheetResult<R, K extends string> = {
  headerLine: number;
  columns: K[];
  rows: R[];
  skipped: { line: number; reason: string }[];
};

export function parseMemberSheet(table: Cell[][]): SheetResult<MemberImportRow, MemberField> {
  const head = findHeaderRow(table, MEMBER_FIELDS, "name");
  const result: SheetResult<MemberImportRow, MemberField> = {
    headerLine: head.index + 1,
    columns: Object.keys(head.map) as MemberField[],
    rows: [],
    skipped: [],
  };
  if (head.index < 0) return result;
  const col = (row: Cell[], k: MemberField) => (head.map[k] === undefined ? null : row[head.map[k]!]);

  table.slice(head.index + 1).forEach((row, i) => {
    const line = head.index + 2 + i;
    if (isBlankRow(row) || isTotalRow(row)) return;
    const name = toText(col(row, "name"))?.replace(/\s/g, "");
    if (!name) {
      result.skipped.push({ line, reason: "이름이 비어 있음" });
      return;
    }
    const birth = toDate(col(row, "birthDate"));
    result.rows.push({
      line,
      name: name.slice(0, 30),
      gender: toGender(col(row, "gender")),
      birthDate: birth.value,
      birthIsLunar: birth.lunar,
      phone: toPhone(col(row, "phone")),
      email: toText(col(row, "email")),
      postalCode: toText(col(row, "postalCode"))?.replace(/\D/g, "").slice(0, 6) || null,
      address: toText(col(row, "address")),
      addressDetail: toText(col(row, "addressDetail")),
      position: toText(col(row, "position")),
      district: toText(col(row, "district")),
      status: toStatus(col(row, "status")),
      registeredAt: toDate(col(row, "registeredAt")).value,
      catechumenAt: toDate(col(row, "catechumenAt")).value,
      baptizedAt: toDate(col(row, "baptizedAt")).value,
      confirmedAt: toDate(col(row, "confirmedAt")).value,
      job: toText(col(row, "job")),
      note: toText(col(row, "note")),
    });
  });
  return result;
}

/* ── 수입 · 지출 ────────────────────────── */

export type FinanceImportRow = {
  line: number;
  date: string;
  direction: "IN" | "OUT";
  amount: number;
  account: string | null;
  category: string | null;
  name: string | null;
  payee: string | null;
  description: string | null;
  method: "CASH" | "TRANSFER" | "CARD" | "OTHER" | null;
};

export function parseFinanceSheet(
  table: Cell[][],
  opts: {
    /** 구분 열이 없을 때 이 파일 전체를 수입/지출 중 무엇으로 볼지 */
    defaultDirection?: "IN" | "OUT" | null;
    /** 교회에 이미 있는 항목. 항목 이름으로 수입/지출을 짐작할 때 쓴다. */
    accounts?: { name: string; type: "INCOME" | "EXPENSE" }[];
  } = {},
): SheetResult<FinanceImportRow, FinanceField> {
  const head = findHeaderRow(table, FINANCE_FIELDS, "date");
  const result: SheetResult<FinanceImportRow, FinanceField> = {
    headerLine: head.index + 1,
    columns: Object.keys(head.map) as FinanceField[],
    rows: [],
    skipped: [],
  };
  if (head.index < 0) return result;
  const col = (row: Cell[], k: FinanceField) => (head.map[k] === undefined ? null : row[head.map[k]!]);
  const accountType = new Map((opts.accounts ?? []).map((a) => [normHeader(a.name), a.type]));

  let lastDate: string | null = null;
  table.slice(head.index + 1).forEach((row, i) => {
    const line = head.index + 2 + i;
    if (isBlankRow(row) || isTotalRow(row)) return;

    // 같은 날짜가 여러 줄이면 첫 줄에만 날짜를 적는 장부가 많다.
    const date = toDate(col(row, "date")).value ?? (toText(col(row, "date")) ? null : lastDate);
    if (!date) {
      result.skipped.push({ line, reason: "날짜를 알아볼 수 없음" });
      return;
    }
    lastDate = date;

    const account = toText(col(row, "account"));
    const common = {
      line,
      date,
      account,
      category: toText(col(row, "category")),
      name: toText(col(row, "name")),
      payee: toText(col(row, "payee")),
      description: toText(col(row, "description")),
      method: toMethod(col(row, "method")),
    };

    const incomeCol = toAmount(col(row, "income"));
    const expenseCol = toAmount(col(row, "expense"));
    if (head.map.income !== undefined || head.map.expense !== undefined) {
      // 수입 열과 지출 열이 따로 있는 장부
      let pushed = false;
      if (incomeCol && incomeCol > 0) {
        result.rows.push({ ...common, direction: "IN", amount: incomeCol });
        pushed = true;
      }
      if (expenseCol && expenseCol > 0) {
        result.rows.push({ ...common, direction: "OUT", amount: expenseCol });
        pushed = true;
      }
      if (!pushed) result.skipped.push({ line, reason: "금액이 없음" });
      return;
    }

    const amount = toAmount(col(row, "amount"));
    if (!amount) {
      result.skipped.push({ line, reason: "금액이 없음" });
      return;
    }
    let direction =
      toDirection(col(row, "kind")) ??
      (account ? (accountType.get(normHeader(account)) === "EXPENSE" ? "OUT" : accountType.get(normHeader(account)) === "INCOME" ? "IN" : null) : null) ??
      opts.defaultDirection ??
      null;
    // 음수 금액은 지출로 본다(구분이 없을 때만)
    if (!direction && amount < 0) direction = "OUT";
    if (!direction) {
      result.skipped.push({ line, reason: "수입인지 지출인지 알 수 없음" });
      return;
    }
    result.rows.push({ ...common, direction, amount: Math.abs(amount) });
  });
  return result;
}

export const FIELD_LABELS: Record<MemberField | FinanceField, string> = {
  name: "이름",
  gender: "성별",
  birthDate: "생년월일",
  phone: "휴대폰",
  email: "이메일",
  postalCode: "우편번호",
  address: "주소",
  addressDetail: "상세주소",
  position: "직분",
  district: "교구·구역",
  status: "상태",
  registeredAt: "등록일",
  catechumenAt: "학습",
  baptizedAt: "세례",
  confirmedAt: "입교",
  job: "직업",
  note: "메모",
  date: "날짜",
  kind: "구분",
  amount: "금액",
  income: "수입",
  expense: "지출",
  account: "항목",
  category: "대분류",
  payee: "거래처",
  description: "적요",
  method: "방법",
};
