/**
 * 목록 → 자세히 → 돌아가기에서 원래 목록(검색어·달·쪽 그대로)으로 돌아가기 위한 주소.
 * 목록이 자세히 화면 주소에 ?back=… 로 자기 주소를 실어 보내고,
 * 자세히 화면의 '← 뒤로'와 저장·삭제 뒤 이동이 그 주소를 쓴다.
 */

/** 이 사이트 안의 주소만 받는다 (다른 사이트로 튕겨 보내는 데 쓰이지 않게). */
export function safeBack(v: string | null | undefined): string | null {
  if (!v || typeof v !== "string" || v.length > 600) return null;
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || /^\/[^?#]*:/.test(v)) return null;
  return v;
}

/** href 에 돌아올 주소를 붙인다 */
export function withBack(href: string, back: string) {
  return `${href}${href.includes("?") ? "&" : "?"}back=${encodeURIComponent(back)}`;
}

/** 돌아갈 주소에 알림 표시(ok=updated 등)를 붙인다 */
export function backWith(back: string, param: string) {
  return `${back}${back.includes("?") ? "&" : "?"}${param}`;
}
