import { test } from "node:test";
import assert from "node:assert/strict";
import { accountTag, balanceGaps, gapKey, orderByBalance, parseGapKey } from "./bank-balance";

let n = 0;
function tx(direction: "IN" | "OUT", amount: number, balance: number, hh: number, mm: number) {
  n++;
  return {
    id: `a${n}`,
    direction,
    amount,
    balance,
    occurredAt: new Date(2026, 9, 1, hh, mm),
    createdAt: new Date(2026, 9, 1, 0, 0, n),
  };
}

test("계좌번호 끝 네 자리", () => {
  assert.equal(accountTag("잔액 50,622원\n현대카드\n469***03801011\n기업"), "1011");
  assert.equal(accountTag("11/03 17:43 301-****-2640-41 파우PC"), "4041");
  assert.equal(accountTag("[IBK]06/12 14:23\n입금 50,000원\n123-******-01-012"), "1012");
  assert.equal(accountTag("신한 입금 1,000 가"), null);
});

test("잔액이 이어지면 빠진 거래가 없다", () => {
  const items = [
    tx("OUT", 26_600, 2_364_744, 10, 0),
    tx("OUT", 21_500, 2_343_244, 12, 0),
    tx("IN", 100_000, 2_443_244, 13, 0),
  ];
  assert.deepEqual(balanceGaps(items), []);
});

test("출금 문자만 받을 때 사이에 들어온 입금을 찾는다", () => {
  const a = tx("OUT", 26_600, 2_364_744, 10, 0);
  // 그 사이 문자 없이 150,000원 입금 → 2,514,744
  const b = tx("OUT", 21_500, 2_493_244, 12, 0);
  const gaps = balanceGaps([b, a]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].gap, 150_000);
  assert.equal(gaps[0].prev.id, a.id);
  assert.equal(gaps[0].next.id, b.id);
  assert.equal(gaps[0].expectedBefore, 2_514_744);
});

test("문자 없이 나간 돈은 음수", () => {
  const a = tx("OUT", 10_000, 500_000, 9, 0);
  const b = tx("OUT", 10_000, 489_000, 11, 0); // 수수료 1,000원이 문자 없이 빠짐
  const gaps = balanceGaps([a, b]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].gap, -1_000);
});

test("같은 시각 거래는 잔액이 이어지는 순서로 늘어놓는다", () => {
  const a = tx("OUT", 5_000, 100_000, 9, 0);
  // 둘 다 10:00. 늦게 들어온 쪽(c)이 실제로는 먼저 일어났다.
  const b = tx("OUT", 3_000, 92_000, 10, 0);
  const c = tx("OUT", 5_000, 95_000, 10, 0);
  assert.deepEqual(orderByBalance([a, b, c]).map((x) => x.id), [a.id, c.id, b.id]);
  assert.deepEqual(balanceGaps([a, b, c]), []);
});

test("잔액이 없는 문자는 건너뛴다", () => {
  const a = tx("OUT", 5_000, 100_000, 9, 0);
  const b = { ...tx("IN", 1_000, 0, 9, 30), balance: null };
  const c = tx("OUT", 5_000, 95_000, 10, 0);
  assert.deepEqual(balanceGaps([a, b, c]), []);
});

test("dedupKey 로 앞뒤 알림을 되찾는다", () => {
  assert.deepEqual(parseGapKey(gapKey("cmabc123", "cmxyz789")), ["cmabc123", "cmxyz789"]);
  assert.equal(parseGapKey("3f9a0c"), null);
});
