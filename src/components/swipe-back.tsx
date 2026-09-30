"use client";

import { useEffect } from "react";

/**
 * 홈 화면에 추가한 웹앱(사파리 주소창 없는 화면)에는 아이폰의 '밀어서 뒤로 가기'가 없다.
 * 화면 왼쪽 끝에서 오른쪽으로 밀면 이전 화면으로 돌아가게 한다.
 * 사파리 브라우저와 아이폰 앱은 스스로 지원하므로 건드리지 않는다.
 */
export function SwipeBack() {
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const nativeApp = "Capacitor" in window;
    if (!standalone || nativeApp) return;

    let start: { x: number; y: number; t: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start = t.clientX < 24 && e.touches.length === 1 ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      if (dx > 80 && dy < 60 && Date.now() - start.t < 800 && window.history.length > 1) window.history.back();
      start = null;
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, []);
  return null;
}
