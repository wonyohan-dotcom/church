/**
 * 헌금자 이름 칸(통장 입금자명·엑셀 이름)에서 교인 이름을 찾는다.
 *
 *   "이숙종 십일조"      → 이숙종
 *   "김동진최창일.감사"   → 김동진, 최창일   (함께 드린 헌금)
 *   "장범준홍지성십일조"  → 장범준, 홍지성
 *
 * 잘못 잇는 것을 막으려고, 이름 앞이 글자 경계일 때만 인정한다.
 *   - 앞: 맨 앞 · 한글이 아닌 글자 · 다른 교인 이름 바로 뒤
 * 두 글자 이름은 다른 이름 속에 들어 있기 쉬워서 뒤도 본다.
 *   - 뒤: 맨 끝 · 한글이 아닌 글자 · 다른 교인 이름 · '십일조', '감사' 같은 헌금 낱말
 * 그래서 교인 '김현' 은 "김현주" 에 걸리지 않지만, '이숙종' 은 "이숙종식대후원금" 에도 걸린다.
 * 같은 이름의 교인이 둘 이상이면(동명이인) 누군지 알 수 없어 잇지 않는다.
 *
 * 이 파일은 서버·브라우저 어디서나 쓸 수 있도록 순수 함수만 둔다.
 */

export type NamedMember = { id: string; name: string };

// 이름 바로 뒤에 붙어 나올 수 있는 낱말 (예: 이숙종십일조, 김재호감사)
const SUFFIXES = [
  "십일조", "감사", "헌금", "주일", "주정", "선교", "건축", "구제", "절기", "부활", "추수",
  "맥추", "성탄", "신년", "송구영신", "일천", "특별", "작정", "생일", "심방", "교육", "참가",
  "회비", "후원", "책", "도서", "교재", "역사서", "모세오경", "성경", "드림", "외", "님",
  "집사", "권사", "장로", "성도", "목사", "전도사", "청년", "가정", "가족", "부부",
];

const HANGUL = /[가-힣]/;

// 헌금자와 잇지 않는 수입 항목. 목사님 개인 계좌에서 옮긴 내부이체가
// 그분의 헌금으로 잡히면 안 된다.
const NOT_GIVING = /내부이체|환불|취소|이자|결산|대체/;

/** 이 수입 항목의 기록을 교인과 이어도 되는지 */
export function canLinkGivers(accountName: string) {
  return !NOT_GIVING.test(accountName);
}

type Span = { id: string; start: number; end: number };

/** 이름 칸에서 찾은 교인 id 들 (이름이 나온 순서대로, 겹치지 않게) */
export function matchGivers(text: string | null | undefined, members: NamedMember[]): string[] {
  if (!text) return [];
  const byName = new Map<string, string | null>();
  for (const m of members) {
    const name = m.name.replace(/\s/g, "");
    if (name.length < 2) continue;
    byName.set(name, byName.has(name) ? null : m.id);
  }

  // 1) 긴 이름부터, 겹치지 않게 자리를 잡는다. ("김동진" 이 "김동" 보다 먼저)
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  const taken = new Array<boolean>(text.length).fill(false);
  let spans: Span[] = [];
  for (const name of names) {
    let from = 0;
    for (;;) {
      const i = text.indexOf(name, from);
      if (i < 0) break;
      from = i + 1;
      const j = i + name.length;
      if (taken.slice(i, j).some(Boolean)) continue;
      for (let k = i; k < j; k++) taken[k] = true;
      spans.push({ id: byName.get(name) ?? "", start: i, end: j });
    }
  }

  // 2) 앞뒤가 경계가 아닌 자리는 버린다. 하나를 버리면 이웃도 다시 본다.
  for (let changed = true; changed; ) {
    changed = false;
    const ok = spans.filter((s) => {
      const left =
        s.start === 0 ||
        !HANGUL.test(text[s.start - 1]) ||
        spans.some((o) => o !== s && o.end === s.start);
      const rest = text.slice(s.end);
      const right =
        s.end - s.start >= 3 ||
        s.end === text.length ||
        !HANGUL.test(text[s.end]) ||
        spans.some((o) => o !== s && o.start === s.end) ||
        SUFFIXES.some((w) => rest.startsWith(w));
      return left && right;
    });
    if (ok.length !== spans.length) {
      spans = ok;
      changed = true;
    }
  }

  // 3) 동명이인(id 없음)은 빼고, 나온 순서대로
  const ids: string[] = [];
  for (const s of spans.sort((a, b) => a.start - b.start)) {
    if (s.id && !ids.includes(s.id)) ids.push(s.id);
  }
  return ids;
}
