"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCamera } from "@/components/icons";
import { MAX_UPLOAD_BYTES, shrinkImage } from "@/lib/shrink-image";
import { MAX_POST_BODY, MAX_POST_PHOTOS } from "@/lib/community-limits";
import { addPostPhoto, createPost } from "./actions";

type Picked = { file: File; url: string };

function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (/body exceeded|body size|413/i.test(m)) return "사진 용량이 너무 큽니다. 다른 사진으로 다시 시도해 주세요.";
  return m || "올리지 못했습니다.";
}

/** 사진은 한 장씩 따로 올린다(요청 크기 한도 때문). 글을 먼저 만들고 사진을 차례로 붙인다. */
export function PostComposer() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  async function onChoose(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []).slice(0, MAX_POST_PHOTOS - picked.length);
    e.target.value = "";
    if (chosen.length === 0) return;
    setError(null);
    setPreparing(true);
    const next: Picked[] = [];
    for (const f of chosen) {
      const small = await shrinkImage(f);
      if (small.size > MAX_UPLOAD_BYTES) {
        setError("용량이 너무 큰 사진은 뺐습니다.");
        continue;
      }
      const url = URL.createObjectURL(small);
      urls.current.push(url);
      next.push({ file: small, url });
    }
    setPicked((prev) => [...prev, ...next].slice(0, MAX_POST_PHOTOS));
    setPreparing(false);
  }

  async function submit() {
    if (busy) return;
    if (!body.trim() && picked.length === 0) {
      setError("사진이나 글을 넣어 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("body", body);
      fd.set("hasPhoto", picked.length ? "1" : "0");
      const res = await createPost(fd);
      if (!res.id) throw new Error(res.error ?? "올리지 못했습니다.");
      for (const p of picked) {
        const pf = new FormData();
        pf.set("photo", p.file);
        await addPostPhoto(res.id, pf);
      }
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = [];
      setPicked([]);
      setBody("");
      router.refresh();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <textarea
        className="field min-h-20 w-full resize-none"
        placeholder="우리 교회 소식과 사진을 나눠 보세요"
        maxLength={MAX_POST_BODY}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={busy}
      />
      {picked.length > 0 && (
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {picked.map((p) => (
            <li key={p.url} className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="사진 빼기"
                className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/60 text-xs text-white"
                onClick={() => setPicked((prev) => prev.filter((x) => x !== p))}
                disabled={busy}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" onChange={onChoose} disabled={busy || preparing} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy || preparing || picked.length >= MAX_POST_PHOTOS}
        >
          <IconCamera width={16} height={16} />
          {preparing ? "준비 중…" : `사진 (${picked.length}/${MAX_POST_PHOTOS})`}
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={busy || preparing}>
          {busy ? "올리는 중…" : "올리기"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-expense">{error}</p>}
    </div>
  );
}
