"use client";

import { useEffect, useState } from "react";

/**
 * 이 기기에서 푸시 알림을 받을지 켜고 끄는 스위치.
 *
 * 아이폰은 사파리에서 그냥 열었을 때는 알림을 받을 수 없고,
 * '홈 화면에 추가'로 설치한 뒤 그 아이콘으로 열어야 동작한다.
 * 그래서 상황별로 무엇을 해야 하는지 문구로 알려 준다.
 */

type State =
  | "loading"
  | "unsupported" // 브라우저가 웹푸시를 지원하지 않음
  | "ios-needs-install" // 아이폰인데 홈 화면에 추가하지 않음
  | "not-configured" // 서버에 VAPID 키가 없음
  | "denied" // 사용자가 알림을 거부함
  | "off"
  | "on"
  | "working";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // 아이폰 사파리 전용 표시
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    // 상태 변경은 모두 await 뒤에서 일어나도록 서버 조회를 가장 먼저 한다.
    (async () => {
      const info = await fetch("/api/push")
        .then((r) => (r.ok ? (r.json() as Promise<{ configured: boolean; publicKey: string | null }>) : null))
        .catch(() => null);
      if (!alive) return;

      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState(isIos() && !isStandalone() ? "ios-needs-install" : "unsupported");
        return;
      }
      if (!info) return setState("unsupported");
      if (!info.configured || !info.publicKey) return setState("not-configured");

      setPublicKey(info.publicKey);
      if (Notification.permission === "denied") return setState("denied");

      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!alive) return;
      setState(sub ? "on" : "off");
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function turnOn() {
    if (!publicKey) return;
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON();
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: json.keys,
          label: navigator.userAgent.slice(0, 120),
        }),
      });

      setState("on");
    } catch {
      setState("off");
    }
  }

  async function turnOff() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch(`/api/push?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: "DELETE",
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  if (state === "loading") {
    return <p className="text-sm text-ink-3">알림 설정을 확인하는 중…</p>;
  }

  const MESSAGES: Partial<Record<State, string>> = {
    unsupported: "이 브라우저는 알림을 지원하지 않습니다. 크롬이나 사파리 최신 버전을 써 주세요.",
    "ios-needs-install":
      "아이폰에서는 사파리 공유 버튼 → '홈 화면에 추가'로 설치한 뒤, 그 아이콘으로 열어야 알림을 받을 수 있습니다.",
    "not-configured":
      "서버에 알림 키(VAPID)가 설정되지 않았습니다. 관리자에게 문의해 주세요.",
    denied:
      "브라우저에서 알림이 차단되어 있습니다. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요.",
  };

  if (MESSAGES[state]) {
    return (
      <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-2">
        {MESSAGES[state]}
      </div>
    );
  }

  const on = state === "on";
  const busy = state === "working";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={on ? "btn btn-ghost" : "btn btn-primary"}
        onClick={on ? turnOff : turnOn}
        disabled={busy}
      >
        {busy ? "처리 중…" : on ? "이 기기에서 알림 끄기" : "이 기기에서 알림 받기"}
      </button>
      <span className="text-sm text-ink-3">
        {on ? "알림이 켜져 있습니다." : "알림이 꺼져 있습니다."}
      </span>
    </div>
  );
}
