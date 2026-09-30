import { test } from "node:test";
import assert from "node:assert/strict";
import { canLinkGivers, matchGivers } from "./givers";

const M = [
  "이숙종", "김동진", "최창일", "장범준", "홍지성", "고은샘", "김승겸", "원요한",
  "김현", "최경대", "김희숙", "박수진", "박수진", "강인",
].map((name, i) => ({ id: `m${i}-${name}`, name }));
const names = (text: string) => matchGivers(text, M).map((id) => id.split("-")[1]);

test("이름만 있으면 그 교인", () => {
  assert.deepEqual(names("이숙종"), ["이숙종"]);
});

test("이름 뒤에 헌금 종류가 붙어도 찾는다", () => {
  assert.deepEqual(names("이숙종 십일조"), ["이숙종"]);
  assert.deepEqual(names("이숙종십일조"), ["이숙종"]);
  assert.deepEqual(names("최경대십일조"), ["최경대"]);
  assert.deepEqual(names("김희숙/역사서1"), ["김희숙"]);
  assert.deepEqual(names("원요한(심플한신앙"), ["원요한"]);
  assert.deepEqual(names("이숙종식대후원금"), ["이숙종"]);
  assert.deepEqual(names("이숙종배블마"), ["이숙종"]);
  assert.deepEqual(names("이숙종맥추감사헌금"), ["이숙종"]);
});

test("두 사람이 함께 드린 헌금", () => {
  assert.deepEqual(names("김동진최창일"), ["김동진", "최창일"]);
  assert.deepEqual(names("김동진최창일.감사"), ["김동진", "최창일"]);
  assert.deepEqual(names("김동진 최창일"), ["김동진", "최창일"]);
  assert.deepEqual(names("장범준홍지성십일조"), ["장범준", "홍지성"]);
  assert.deepEqual(names("고은샘김승겸"), ["고은샘", "김승겸"]);
  assert.deepEqual(names("김승겸고은샘"), ["김승겸", "고은샘"]);
});

test("다른 사람 이름 속 글자에는 걸리지 않는다", () => {
  assert.deepEqual(names("김현주"), []); // 교인 '김현' 이 아니다
  assert.deepEqual(names("강인숙"), []);
  assert.deepEqual(names("박이숙종"), []);
});

test("동명이인은 잇지 않는다", () => {
  assert.deepEqual(names("박수진"), []);
});

test("빈 이름", () => {
  assert.deepEqual(names(""), []);
  assert.deepEqual(matchGivers(null, M), []);
});

test("내부이체·환불·이자는 헌금자와 잇지 않는다", () => {
  assert.equal(canLinkGivers("내부이체"), false);
  assert.equal(canLinkGivers("환불·취소"), false);
  assert.equal(canLinkGivers("이자"), false);
  assert.equal(canLinkGivers("감사헌금"), true);
  assert.equal(canLinkGivers("후원금"), true);
  assert.equal(canLinkGivers("바이블PT 참가비"), true);
});

test("성을 빼고 이름만 쓴 부부 헌금", () => {
  assert.deepEqual(names("범준지성"), ["장범준", "홍지성"]);
  assert.deepEqual(names("지성범준감사헌금"), ["홍지성", "장범준"]);
  assert.deepEqual(names("지성범준 십일조"), ["홍지성", "장범준"]);
  assert.deepEqual(names("은샘승겸"), ["고은샘", "김승겸"]);
});

test("이름 한 단어만 있으면 흔한 낱말일 수 있어 잇지 않는다", () => {
  assert.deepEqual(names("범준"), []);
  assert.deepEqual(names("범준감사"), []);
  assert.deepEqual(names("지성인"), []);
});
