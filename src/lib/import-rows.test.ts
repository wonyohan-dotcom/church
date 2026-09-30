import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFinanceSheet, parseMemberSheet, toDate, toPhone } from "./import-rows";

test("날짜 여러 모양", () => {
  assert.equal(toDate("2024.3.1").value, "2024-03-01");
  assert.equal(toDate("2024-03-01").value, "2024-03-01");
  assert.equal(toDate("2024년 3월 1일").value, "2024-03-01");
  assert.equal(toDate("19650301").value, "1965-03-01");
  assert.equal(toDate("65.3.1").value, "1965-03-01");
  assert.equal(toDate(45352).value, "2024-03-01"); // 엑셀 일련번호
  assert.equal(toDate(new Date(Date.UTC(2024, 2, 1))).value, "2024-03-01");
  assert.deepEqual(toDate("1958.10.3(음)"), { value: "1958-10-03", lunar: true });
  assert.equal(toDate("2024.2.30").value, null);
  assert.equal(toDate("모름").value, null);
});

test("전화번호: 앞자리 0 이 빠진 숫자도 고친다", () => {
  assert.equal(toPhone(1012345678), "010-1234-5678");
  assert.equal(toPhone("010 1234 5678"), "010-1234-5678");
  assert.equal(toPhone("02-123-4567"), "02-123-4567");
});

test("교인 명단 — 제목 줄이 위에 있고 열 이름이 제각각", () => {
  const t = [
    ["은혜교회 교적부 (2024)", null, null],
    [],
    ["번호", "성명", "성별", "생년월일", "집전화", "핸드폰", "주소", "직분", "구역", "비고"],
    [1, "김은혜", "여", "1965.3.1", "02-123-4567", "010-1111-2222", "서울시 도봉구", "권사", "1구역", ""],
    [2, "박 성실", "남", 21000, null, "1033334444", null, "장로", "2구역", "새가족"],
    [3, null, "남", null, null, null, null, null, null, null],
    ["합계", null],
  ];
  const r = parseMemberSheet(t);
  assert.equal(r.headerLine, 3);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].name, "김은혜");
  assert.equal(r.rows[0].gender, "F");
  assert.equal(r.rows[0].birthDate, "1965-03-01");
  assert.equal(r.rows[0].phone, "010-1111-2222", "휴대폰 열이 집전화보다 먼저 잡혀야 함");
  assert.equal(r.rows[0].district, "1구역");
  assert.equal(r.rows[1].name, "박성실");
  assert.equal(r.rows[1].phone, "010-3333-4444");
  assert.equal(r.rows[1].birthDate, "1957-06-29");
  assert.equal(r.skipped.length, 1);
});

test("재정 — 수입 열과 지출 열이 따로 있는 장부, 날짜가 첫 줄에만", () => {
  const t = [
    ["2024년 3월 재정 장부"],
    ["일자", "적요", "항목", "성명", "수입", "지출", "잔액"],
    ["2024.3.3", "주일헌금", "주일헌금", "김은혜", "50,000", "", ""],
    [null, "십일조", "십일조", "박성실", 300000, null, null],
    ["2024.3.5", "전기요금", "공과금", "", "", "123,450원", ""],
    ["합계", "", "", "", 350000, 123450, ""],
  ];
  const r = parseFinanceSheet(t);
  assert.equal(r.rows.length, 3);
  assert.deepEqual(
    r.rows.map((x) => [x.date, x.direction, x.amount, x.account, x.name]),
    [
      ["2024-03-03", "IN", 50000, "주일헌금", "김은혜"],
      ["2024-03-03", "IN", 300000, "십일조", "박성실"],
      ["2024-03-05", "OUT", 123450, "공과금", null],
    ],
  );
});

test("재정 — 구분 열 + 금액 한 열", () => {
  const t = [
    ["날짜", "구분", "계정과목", "금액", "내용", "거래처"],
    ["2024-04-07", "수입", "감사헌금", 100000, "", ""],
    ["2024-04-08", "지출", "사무비품비", "35,000", "복사용지", "오피스디포"],
    ["2024-04-09", "", "알수없음", 1000, "", ""],
  ];
  const r = parseFinanceSheet(t);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[1].payee, "오피스디포");
  assert.equal(r.rows[1].description, "복사용지");
  assert.equal(r.skipped[0].reason, "수입인지 지출인지 알 수 없음");
});

test("재정 — 구분이 없으면 항목 이름이나 파일 전체 설정으로 판단", () => {
  const t = [
    ["날짜", "항목", "금액"],
    ["2024-04-07", "주일헌금", 10000],
    ["2024-04-07", "공과금", 20000],
    ["2024-04-07", "처음보는항목", 30000],
  ];
  const r = parseFinanceSheet(t, {
    accounts: [
      { name: "주일헌금", type: "INCOME" },
      { name: "공과금", type: "EXPENSE" },
    ],
    defaultDirection: "IN",
  });
  assert.deepEqual(r.rows.map((x) => x.direction), ["IN", "OUT", "IN"]);
});
