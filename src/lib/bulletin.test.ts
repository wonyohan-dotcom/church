import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseLines, parseOrder } from "./bulletin";

describe("parseLines", () => {
  it("번호·기호와 빈 줄을 정리한다", () => {
    assert.deepEqual(parseLines("1. 새가족 환영회\n\n- 주일 식사 12시 30분\n• 청년부 수련회"), [
      "새가족 환영회",
      "주일 식사 12시 30분",
      "청년부 수련회",
    ]);
  });
  it("빈 값은 빈 목록", () => {
    assert.deepEqual(parseLines(null), []);
    assert.deepEqual(parseLines("  \n "), []);
  });
});

describe("parseOrder", () => {
  it("순서와 담당을 나눈다", () => {
    assert.deepEqual(parseOrder("묵도\n말씀 | 원요한 목사\n찬송 | 다 같이"), [
      { name: "묵도", detail: null },
      { name: "말씀", detail: "원요한 목사" },
      { name: "찬송", detail: "다 같이" },
    ]);
  });
});
