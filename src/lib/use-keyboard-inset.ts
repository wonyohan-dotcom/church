"use client";

import { useEffect, useState } from "react";

/**
 * 휴대폰 키보드가 올라오면 화면 아래쪽이 가려진다.
 * 키보드가 차지한 높이(gap)와 보이는 영역의 높이(height)를 알려 준다.
 * 바닥에 붙는 창(시트)을 키보드 위로 올리는 데 쓴다.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState({ gap: 0, height: 0 });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () =>
      setInset({
        gap: Math.max(0, Math.round(window.innerHeight - (vv.offsetTop + vv.height))),
        height: Math.round(vv.height),
      });
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, []);
  return inset;
}
