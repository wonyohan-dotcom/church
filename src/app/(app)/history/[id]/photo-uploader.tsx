"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCamera } from "@/components/icons";
import { addHistoryPhoto } from "../actions";

type Picked = { file: File; url: string; caption: string };

// upload.ts 의 MAX_BYTES, next.config.ts 의 bodySizeLimit 과 맞춘 값.
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/**
 * 서버 액션 크기 제한을 넘기면 Next.js 가 영어 원문 오류를 그대로 던진다.
 * 미리 걸러내지 못한 경우를 위한 마지막 방어선이라, 알아볼 수 있는 말로 바꾼다.
 */
function friendlyUploadError(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  if (/body exceeded|body size|413/i.test(message)) {
    return "사진 용량이 너무 큽니다. 4MB 이하로 줄여서 다시 시도해 주세요.";
  }
  return message || "저장하지 못했습니다.";
}

/**
 * 사진을 한 장씩 순서대로 올린다.
 *
 * 여러 장을 하나의 요청으로 묶어 보내면 Vercel 이 요청 하나당 정해 둔 크기
 * 한도(4.5MB)를 금방 넘는다. 그래서 파일 선택 후 저장을 누르면, 화면에서
 * 한 장씩 addHistoryPhoto 를 순서대로 호출해 올린다.
 */
export function HistoryPhotoUploader({
  eventId,
  remaining,
}: {
  eventId: string;
  remaining: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      for (const u of objectUrls.current) URL.revokeObjectURL(u);
    };
  }, []);

  function onChoose(e: React.ChangeEvent<HTMLInputElement>) {
    for (const u of objectUrls.current) URL.revokeObjectURL(u);
    objectUrls.current = [];
    setError(null);

    const chosen = Array.from(e.target.files ?? []).slice(0, remaining);
    const files = chosen.filter((f) => f.size <= MAX_PHOTO_BYTES);
    const skipped = chosen.length - files.length;
    if (skipped > 0) {
      setError(
        `${skipped}장은 용량이 4MB를 넘어 빠졌습니다. 사진 크기를 줄여서 다시 선택해 주세요.`,
      );
    }

    setPicked(
      files.map((file) => {
        const url = URL.createObjectURL(file);
        objectUrls.current.push(url);
        return { file, url, caption: "" };
      }),
    );
  }

  function setCaption(index: number, caption: string) {
    setPicked((prev) => prev.map((p, i) => (i === index ? { ...p, caption } : p)));
  }

  async function upload() {
    if (picked.length === 0) return;
    setUploading(true);
    setError(null);
    setProgress(0);

    for (const [i, p] of picked.entries()) {
      const fd = new FormData();
      fd.set("photo", p.file);
      fd.set("caption", p.caption);
      try {
        await addHistoryPhoto(eventId, fd);
        setProgress(i + 1);
      } catch (e) {
        setError(
          `${i + 1}번째 사진(${p.file.name})에서 멈췄습니다: ${friendlyUploadError(e)} ` +
            `이미 올라간 ${i}장은 저장되어 있습니다.`,
        );
        setUploading(false);
        return;
      }
    }

    for (const u of objectUrls.current) URL.revokeObjectURL(u);
    objectUrls.current = [];
    setPicked([]);
    setUploading(false);
    router.refresh();
  }

  if (remaining <= 0) return null;

  return (
    <div className="mt-4 border-t border-line pt-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onChoose}
        className="sr-only"
        disabled={uploading}
      />
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <IconCamera width={16} height={16} />
        {picked.length > 0 ? `${picked.length}장 선택됨 · 다시 고르기` : "사진 추가"}
      </button>
      <p className="mt-1.5 text-xs text-ink-3">
        최대 {remaining}장 더 추가할 수 있습니다. 한 장씩 순서대로 올라갑니다. (장당 4MB 이하)
      </p>

      {picked.length > 0 && (
        <>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {picked.map((p, i) => (
              <li key={p.url}>
                <div className="aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface-2">
                  {/* 아직 서버에 올라가지 않은 로컬 미리보기라 기본 img를 쓴다. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                </div>
                <input
                  type="text"
                  className="field mt-1.5 text-xs"
                  placeholder="사진 설명 (선택)"
                  value={p.caption}
                  onChange={(e) => setCaption(i, e.target.value)}
                  disabled={uploading}
                />
              </li>
            ))}
          </ul>

          <button type="button" className="btn btn-primary mt-4" onClick={upload} disabled={uploading}>
            {uploading ? `올리는 중… (${progress}/${picked.length}장)` : "사진 저장"}
          </button>
        </>
      )}

      {error && <p className="mt-3 text-sm text-expense">{error}</p>}
    </div>
  );
}
