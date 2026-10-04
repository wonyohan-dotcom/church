/** 주보 입력칸(한 줄에 하나)을 다루는 도우미 */

/** 빈 줄을 없애고 앞의 "1." "-" "•" 같은 번호·기호를 뗀 줄 목록 */
export function parseLines(text: string | null | undefined, max = 30): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•·*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, max)
    .map((l) => l.slice(0, 200));
}

export type OrderStep = { name: string; detail: string | null };

/** 예배 순서: "말씀 | 김목사" → { name: "말씀", detail: "김목사" } */
export function parseOrder(text: string | null | undefined): OrderStep[] {
  return parseLines(text, 20).map((line) => {
    const [name, ...rest] = line.split("|").map((p) => p.trim());
    const detail = rest.join(" ").trim();
    return { name: name || line, detail: detail || null };
  });
}

/** 이 주보에 보여 줄 내용이 하나라도 있는지 */
export function hasBody(b: {
  sermonTitle: string | null;
  scripture: string | null;
  worshipOrder: string | null;
  announcements: string | null;
  prayers: string | null;
  note: string | null;
}) {
  return !!(b.sermonTitle || b.scripture || b.worshipOrder || b.announcements || b.prayers || b.note);
}
