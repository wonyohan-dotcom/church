"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { IconX } from "./icons";

export type GalleryPhoto = { url: string; caption?: string | null };

const Ctx = createContext<((index: number) => void) | null>(null);

/**
 * 사진을 눌러 크게 보는 갤러리. 서버 화면의 사진 묶음을 감싸고,
 * 안쪽 사진마다 <GalleryOpen index={n}> 으로 감싸면 눌렀을 때 그 사진부터 열린다.
 * 열린 뒤에는 옆으로 밀거나 화살표로 넘기고, 저장 버튼으로 내려받는다.
 */
export function GalleryRoot({ photos, children }: { photos: GalleryPhoto[]; children: React.ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  const show = useCallback((i: number) => setOpen(i), []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {open !== null && <Viewer photos={photos} start={open} onClose={() => setOpen(null)} />}
    </Ctx.Provider>
  );
}

export function GalleryOpen({
  index,
  className,
  children,
  label = "사진 크게 보기",
}: {
  index: number;
  className?: string;
  children: React.ReactNode;
  label?: string;
}) {
  const show = useContext(Ctx);
  return (
    <button type="button" className={className} onClick={() => show?.(index)} aria-label={label}>
      {children}
    </button>
  );
}

/** 저장용 주소: 같은 도메인에서 파일 그대로 내려받게 한다. */
function downloadUrl(url: string) {
  return url + (url.includes("?") ? "&" : "?") + "dl=1";
}

function Viewer({ photos, start, onClose }: { photos: GalleryPhoto[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const [note, setNote] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (i: number, smooth = true) => {
      const el = scroller.current;
      if (!el) return;
      const next = Math.max(0, Math.min(photos.length - 1, i));
      el.scrollTo({ left: next * el.clientWidth, behavior: smooth ? "smooth" : "instant" });
    },
    [photos.length],
  );

  // 열릴 때 누른 사진 위치로 바로 이동, 뒤 화면은 움직이지 않게 잠근다.
  useEffect(() => {
    goTo(start, false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [goTo, start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goTo(index - 1);
      if (e.key === "ArrowRight") goTo(index + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [goTo, index, onClose]);

  async function save() {
    const photo = photos[index];
    setNote(null);
    try {
      const res = await fetch(downloadUrl(photo.url));
      if (!res.ok) throw new Error("fetch");
      const blob = await res.blob();
      const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
      const file = new File([blob], `photo-${index + 1}.${ext}`, { type: blob.type });
      // 휴대폰: 공유 창에서 '이미지 저장'을 고를 수 있다.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] }).catch(() => {});
        return;
      }
      // 컴퓨터 등: 바로 파일로 내려받는다.
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch {
      setNote("저장하지 못했습니다. 사진을 길게 눌러 저장해 주세요.");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="사진 크게 보기">
      <div className="flex items-center justify-between px-3 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10" aria-label="닫기">
          <IconX width={22} height={22} />
        </button>
        <span className="tnum text-sm font-semibold opacity-90">
          {index + 1} / {photos.length}
        </span>
        <button type="button" onClick={save} className="flex h-11 items-center rounded-full px-4 text-sm font-bold hover:bg-white/10">
          저장
        </button>
      </div>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((p, i) => (
          <div key={i} className="flex h-full w-full shrink-0 snap-center items-center justify-center px-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption ?? ""} className="max-h-full max-w-full object-contain" draggable={false} />
          </div>
        ))}
      </div>

      {photos.length > 1 && (
        <>
          <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-xl disabled:opacity-30 sm:flex" aria-label="이전 사진">
            ‹
          </button>
          <button type="button" onClick={() => goTo(index + 1)} disabled={index === photos.length - 1} className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-xl disabled:opacity-30 sm:flex" aria-label="다음 사진">
            ›
          </button>
        </>
      )}

      <div className="px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3 text-center">
        {photos[index]?.caption && <p className="text-sm leading-relaxed opacity-90">{photos[index].caption}</p>}
        {note && <p className="mt-1 text-xs text-[#ffb4b4]">{note}</p>}
      </div>
    </div>
  );
}
