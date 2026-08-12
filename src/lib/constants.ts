// 도메인 공통 상수 — 화면 라벨과 DB 값의 단일 출처

export const ROLES = {
  ADMIN: "관리자",
  FINANCE: "회계",
  PASTOR: "교역자",
  MEMBER: "성도",
} as const;
export type Role = keyof typeof ROLES;

/** 관리자 화면(교적·회계·역사) 접근이 가능한 역할 */
export const STAFF_ROLES: Role[] = ["ADMIN", "FINANCE", "PASTOR"];
/** 회계 데이터를 수정할 수 있는 역할 */
export const FINANCE_ROLES: Role[] = ["ADMIN", "FINANCE"];

/** 로그인 계정의 상태 — 가입 신청 후 관리자가 승인해야 사용할 수 있다. */
export const USER_STATUS = {
  PENDING: "승인 대기",
  ACTIVE: "사용 중",
  REJECTED: "거절됨",
  SUSPENDED: "정지됨",
} as const;
export type UserStatus = keyof typeof USER_STATUS;

/** 관리자가 가입 신청을 승인하면서 고를 수 있는 권한과 설명 */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "모든 기능 + 교회 설정과 계정 관리",
  FINANCE: "교적 조회 + 헌금·지출 입력, 영수증 발급",
  PASTOR: "교적과 교회 역사 관리 (헌금 내역은 볼 수 없음)",
  MEMBER: "본인 헌금 내역과 기부금영수증만",
};

export const MEMBER_STATUS = {
  ACTIVE: "재적",
  INACTIVE: "장기결석",
  TRANSFERRED: "이명",
  DECEASED: "소천",
} as const;
export type MemberStatus = keyof typeof MEMBER_STATUS;

export const POSITIONS = [
  "목사",
  "부목사",
  "전도사",
  "장로",
  "권사",
  "안수집사",
  "서리집사",
  "성도",
] as const;

export const HOUSEHOLD_RELATIONS = [
  "본인",
  "배우자",
  "자녀",
  "부모",
  "형제자매",
  "기타",
] as const;

export const GENDERS = { M: "남", F: "여" } as const;

export const PAYMENT_METHODS = {
  CASH: "현금",
  TRANSFER: "계좌이체",
  CARD: "카드",
  OTHER: "기타",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const RECEIPT_STATUS = {
  REQUESTED: "신청접수",
  ISSUED: "발급완료",
  REJECTED: "반려",
  CANCELED: "취소",
} as const;
export type ReceiptStatus = keyof typeof RECEIPT_STATUS;

export const HISTORY_CATEGORIES = {
  FOUNDING: "설립·창립",
  BUILDING: "건축·이전",
  ORDINATION: "임직·안수",
  PASTOR: "교역자",
  MISSION: "선교·전도",
  EVENT: "행사·집회",
  GENERAL: "일반",
} as const;
export type HistoryCategory = keyof typeof HISTORY_CATEGORIES;

/** 신규 설치 시 기본 계정과목 */
export const DEFAULT_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  category?: string;
  isOffering?: boolean;
  deductible?: boolean;
}> = [
  { code: "1010", name: "주일헌금", type: "INCOME", category: "헌금", isOffering: true },
  { code: "1020", name: "십일조", type: "INCOME", category: "헌금", isOffering: true },
  { code: "1030", name: "감사헌금", type: "INCOME", category: "헌금", isOffering: true },
  { code: "1040", name: "선교헌금", type: "INCOME", category: "헌금", isOffering: true },
  { code: "1050", name: "건축헌금", type: "INCOME", category: "헌금", isOffering: true },
  { code: "1060", name: "절기헌금", type: "INCOME", category: "헌금", isOffering: true },
  { code: "1070", name: "구제헌금", type: "INCOME", category: "헌금", isOffering: true },
  { code: "1080", name: "특별헌금", type: "INCOME", category: "헌금", isOffering: true },
  { code: "1900", name: "기타수입", type: "INCOME", category: "기타", isOffering: false, deductible: false },

  { code: "2010", name: "교역자 사례비", type: "EXPENSE", category: "인건비" },
  { code: "2020", name: "직원 급여", type: "EXPENSE", category: "인건비" },
  { code: "2110", name: "임대료", type: "EXPENSE", category: "관리비" },
  { code: "2120", name: "공과금", type: "EXPENSE", category: "관리비" },
  { code: "2130", name: "시설 유지보수", type: "EXPENSE", category: "관리비" },
  { code: "2210", name: "예배·행사비", type: "EXPENSE", category: "사역비" },
  { code: "2220", name: "교육부서 사역비", type: "EXPENSE", category: "사역비" },
  { code: "2230", name: "선교비", type: "EXPENSE", category: "사역비" },
  { code: "2240", name: "구제비", type: "EXPENSE", category: "사역비" },
  { code: "2310", name: "사무·비품비", type: "EXPENSE", category: "일반운영비" },
  { code: "2320", name: "차량 유지비", type: "EXPENSE", category: "일반운영비" },
  { code: "2900", name: "기타지출", type: "EXPENSE", category: "기타" },
];
