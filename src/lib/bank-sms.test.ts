import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBankMessage, splitMessages } from "./bank-sms";

// 2026년 6월 13일 오전 10시에 받았다고 가정
const NOW = new Date(2026, 5, 13, 10, 0);

type Expect = {
  direction: "IN" | "OUT";
  amount: number;
  balance?: number | null;
  counterparty?: string | null;
  bankName?: string | null;
  at?: [number, number, number, number, number] | null;
};

function check(text: string, e: Expect) {
  const r = parseBankMessage(text, NOW);
  assert.ok(r, `읽지 못함: ${text}`);
  assert.equal(r.direction, e.direction, "입출금 방향");
  assert.equal(r.amount, e.amount, "금액");
  if (e.balance !== undefined) assert.equal(r.balance, e.balance, "잔액");
  if (e.counterparty !== undefined) assert.equal(r.counterparty, e.counterparty, "상대");
  if (e.bankName !== undefined) assert.equal(r.bankName, e.bankName, "은행");
  if (e.at !== undefined) {
    if (e.at === null) assert.equal(r.occurredAt, null);
    else assert.deepEqual(r.occurredAt, new Date(e.at[0], e.at[1] - 1, e.at[2], e.at[3], e.at[4]));
  }
}

/* ── 기업은행 · 농협 (이 교회가 쓰는 은행) ───────── */

test("기업은행 — 출금, 은행 이름이 맨 끝 줄", () => {
  check("[Web발신]\n2024/11/15 12:57\n출금 354,594원\n잔액 50,622원\n현대카드\n469***03801011\n기업", {
    direction: "OUT", amount: 354594, balance: 50622, counterparty: "현대카드",
    bankName: "IBK기업", at: [2024, 11, 15, 12, 57],
  });
});

test("기업은행 — 입금", () => {
  check("[Web발신]\n2026/06/12 09:05\n입금 100,000원\n잔액 1,150,622원\n홍길동\n469***03801011\n기업", {
    direction: "IN", amount: 100000, balance: 1150622, counterparty: "홍길동",
    bankName: "IBK기업", at: [2026, 6, 12, 9, 5],
  });
});

test("기업은행 — 띄어쓰기가 있는 가게 이름은 줄 전체", () => {
  check("[Web발신]\n2026/10/01 10:00\n출금 26,600원\n잔액 2,364,744원\n스타벅스 코리아\n461***04016\n기업", {
    direction: "OUT", amount: 26600, counterparty: "스타벅스 코리아",
  });
  check("[Web발신]\n2026/10/01 12:00\n출금 21,500원\n잔액 2,324,244원\n주식회사 스타필드고\n461***04016\n기업", {
    direction: "OUT", amount: 21500, counterparty: "주식회사 스타필드고",
  });
});

test("기업은행 — [IBK] 머리말 형식", () => {
  check("[Web발신]\n[IBK]06/12 14:23\n입금 50,000원\n김믿음\n잔액 984,567원\n123-******-01-012", {
    direction: "IN", amount: 50000, balance: 984567, counterparty: "김믿음", bankName: "IBK기업",
  });
});

test("기업은행 — 국민연금 같은 이름을 은행으로 착각하지 않는다", () => {
  check("[Web발신]\n2026/06/10 10:00\n출금 320,000원\n잔액 500,000원\n국민연금공단\n469***03801011\n기업", {
    direction: "OUT", amount: 320000, counterparty: "국민연금공단", bankName: "IBK기업",
  });
});

test("농협 — 출금 한 줄 형식", () => {
  check("[Web발신]\n농협 출금2,500원\n11/03 17:43 301-****-2640-41 파우PC 잔액5,428원", {
    direction: "OUT", amount: 2500, balance: 5428, counterparty: "파우PC", bankName: "농협",
    at: [2025, 11, 3, 17, 43],
  });
});

test("농협 — 입금", () => {
  check("[Web발신]\n농협 입금300,000원\n06/12 11:02 301-****-2640-41 이사랑 잔액1,305,428원", {
    direction: "IN", amount: 300000, balance: 1305428, counterparty: "이사랑", bankName: "농협",
    at: [2026, 6, 12, 11, 2],
  });
});

test("농협 — [NH농협] 머리말과 원 없는 금액", () => {
  check("[NH농협] 06/12 14:23 301-****-2640-41 입금 50,000 박소망 잔액 1,000,000", {
    direction: "IN", amount: 50000, balance: 1000000, counterparty: "박소망", bankName: "농협",
  });
});

/* ── 그 밖의 은행 (혹시 몰라) ───────────────────── */

test("KB국민 — 이름이 금액 앞 줄에 온다", () => {
  check("[Web발신]\nKB국민 06/12 14:23\n123456**789\n홍길동\n입금\n50,000\n잔액1,234,567", {
    direction: "IN", amount: 50000, balance: 1234567, counterparty: "홍길동",
    bankName: "KB국민", at: [2026, 6, 12, 14, 23],
  });
});

test("신한 — 입금 뒤 공백, 이름이 마지막 줄", () => {
  check("[Web발신]\n신한06/12 14:23\n110-***-123456\n입금     50,000\n잔액  1,234,567\n 홍길동", {
    direction: "IN", amount: 50000, balance: 1234567, counterparty: "홍길동", bankName: "신한",
    at: [2026, 6, 12, 14, 23],
  });
});

test("우리 — 원 표기", () => {
  check("[Web발신]\n우리 06/12 14:23\n1002***123456\n입금 100,000원\n김영희\n잔액 2,000,000원", {
    direction: "IN", amount: 100000, balance: 2000000, counterparty: "김영희", bankName: "우리",
  });
});

test("농협 — 한 줄에 모두", () => {
  check("[Web발신]\n농협 입금30,000원\n06/12 14:23 351-****-1234-56 박철수 잔액1,234,567원", {
    direction: "IN", amount: 30000, balance: 1234567, counterparty: "박철수", bankName: "농협",
    at: [2026, 6, 12, 14, 23],
  });
});

test("하나 — 쉼표 구분", () => {
  check("[Web발신]\n하나,06/12,14:23\n123-******-12345\n입금10,000원\n이순신\n잔액1,000,000원", {
    direction: "IN", amount: 10000, counterparty: "이순신", bankName: "하나",
    at: [2026, 6, 12, 14, 23],
  });
});

test("IBK — 출금(지급)", () => {
  check("[Web발신]\n[IBK]06/12 14:23\n지급 250,000원\n한국전력공사\n잔액 984,567원\n123-******-01-012", {
    direction: "OUT", amount: 250000, balance: 984567, counterparty: "한국전력공사",
  });
});

test("KB — 체크카드출금", () => {
  check("[Web발신]\nKB국민 06/12 18:02\n123456**789\n다이소\n체크카드출금\n12,300\n잔액1,222,267", {
    direction: "OUT", amount: 12300, balance: 1222267, counterparty: "다이소",
  });
});

test("카카오뱅크 — 가려진 이름은 건너뛴다", () => {
  check("카카오뱅크 홍*동(1234) 06/12 14:23 입금 50,000원 최믿음 잔액 1,234,567원", {
    direction: "IN", amount: 50000, counterparty: "최믿음", bankName: "카카오뱅크",
  });
});

test("토스식 문장 — 님이 보냈어요는 입금", () => {
  check("홍길동님이 50,000원을 보냈어요", { direction: "IN", amount: 50000, counterparty: "홍길동" });
});

test("토스식 문장 — 님께 보냈어요는 출금", () => {
  check("홍길동님께 50,000원을 보냈어요", { direction: "OUT", amount: 50000, counterparty: "홍길동" });
});

test("연말 문자를 새해에 받으면 작년 날짜", () => {
  const r = parseBankMessage("신한 12/31 23:50 입금 10,000 홍길동", new Date(2027, 0, 1, 0, 10));
  assert.deepEqual(r?.occurredAt, new Date(2026, 11, 31, 23, 50));
});

test("날짜가 없으면 null", () => {
  check("입금 5,000원 홍길동", { direction: "IN", amount: 5000, at: null });
});

test("입출금 문자가 아니면 null", () => {
  assert.equal(parseBankMessage("[Web발신] 인증번호 [123456]을 입력해 주세요", NOW), null);
  assert.equal(parseBankMessage("오늘 저녁 7시 구역예배 있습니다", NOW), null);
  assert.equal(parseBankMessage("", NOW), null);
});

test("여러 통을 붙여넣으면 나눈다", () => {
  const parts = splitMessages("[Web발신]\n신한 입금 1,000 가\n[Web발신]\n신한 출금 2,000 나");
  assert.equal(parts.length, 2);
});
