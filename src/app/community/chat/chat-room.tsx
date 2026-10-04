"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconSend } from "@/components/icons";
import { MAX_CHAT_BODY } from "@/lib/community-limits";
import { REPORT_REASONS } from "@/lib/community-reasons";
import { blockUser, reportContent } from "../actions";

type Msg = { id: string; body: string; createdAt: string; authorId: string; authorName: string };

const POLL_MS = 4000;

function clock(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 전체 채팅방. 몇 초마다 새 글을 가져온다(화면이 보일 때만). */
export function ChatRoom() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const last = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const load = useCallback(async () => {
    try {
      const q = last.current ? `?after=${encodeURIComponent(last.current)}` : "";
      const res = await fetch(`/api/community/chat${q}`, { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { me: string; canModerate: boolean; messages: Msg[] };
      setMe(data.me);
      setCanModerate(data.canModerate);
      setLoaded(true);
      if (data.messages.length > 0) {
        last.current = data.messages[data.messages.length - 1].createdAt;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const fresh = data.messages.filter((m) => !seen.has(m.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
      }
    } catch {
      // 네트워크가 잠깐 끊겨도 다음 주기에 다시 시도한다.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (stick.current) bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    const onScroll = () => {
      stick.current = window.innerHeight + window.scrollY >= document.body.scrollHeight - 120;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/community/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setNotice(data.error ?? "보내지 못했습니다.");
      } else {
        setText("");
        stick.current = true;
        await load();
      }
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    setMenu(null);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/community/chat?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async function report(id: string, reason: string) {
    setMenu(null);
    const fd = new FormData();
    fd.set("kind", "CHAT");
    fd.set("targetId", id);
    fd.set("reason", reason);
    await reportContent(fd);
    setNotice("신고했습니다. 관리자가 확인합니다.");
  }

  async function block(userId: string) {
    setMenu(null);
    const fd = new FormData();
    fd.set("userId", userId);
    await blockUser(fd);
    setMessages((prev) => prev.filter((m) => m.authorId !== userId));
    setNotice("차단했습니다. 이 사람의 글은 더 이상 보이지 않습니다.");
  }

  return (
    <div className="flex flex-col">
      <div className="min-h-[50dvh] space-y-1 pb-28">
        {!loaded && <p className="py-10 text-center text-sm text-ink-3">불러오는 중…</p>}
        {loaded && messages.length === 0 && (
          <p className="py-16 text-center text-sm text-ink-3">아직 대화가 없습니다. 첫 인사를 남겨 보세요.</p>
        )}
        {messages.map((m, i) => {
          const mine = m.authorId === me;
          const newDay = i === 0 || dayLabel(messages[i - 1].createdAt) !== dayLabel(m.createdAt);
          const showName = !mine && (newDay || messages[i - 1].authorId !== m.authorId);
          return (
            <div key={m.id}>
              {newDay && <p className="my-3 text-center text-xs text-ink-3">{dayLabel(m.createdAt)}</p>}
              <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                {showName && <p className="mb-0.5 mt-2 px-1 text-xs font-semibold text-ink-2">{m.authorName}</p>}
                <div className={`flex max-w-[85%] items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setMenu(menu === m.id ? null : m.id)}
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-left text-[0.93rem] leading-snug ${
                      mine ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink"
                    }`}
                  >
                    {m.body}
                  </button>
                  <span className="shrink-0 pb-0.5 text-[0.65rem] text-ink-3">{clock(m.createdAt)}</span>
                </div>
                {menu === m.id && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    {(mine || canModerate) && (
                      <button type="button" className="btn btn-ghost btn-sm text-expense" onClick={() => remove(m.id)}>
                        삭제
                      </button>
                    )}
                    {!mine && (
                      <>
                        <select
                          className="field py-1 text-xs"
                          defaultValue=""
                          onChange={(e) => e.target.value && report(m.id, e.target.value)}
                          aria-label="신고하기"
                        >
                          <option value="" disabled>
                            신고하기…
                          </option>
                          {REPORT_REASONS.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => block(m.authorId)}>
                          이 사람 차단
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={send}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        {notice && <p className="mx-auto max-w-2xl px-4 pt-2 text-xs text-ink-2">{notice}</p>}
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2.5">
          <input
            className="field min-w-0 flex-1"
            placeholder="메시지 입력"
            value={text}
            maxLength={MAX_CHAT_BODY}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            enterKeyHint="send"
          />
          <button type="submit" className="btn btn-primary shrink-0 px-3.5" disabled={sending || !text.trim()} aria-label="보내기">
            <IconSend width={18} height={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
