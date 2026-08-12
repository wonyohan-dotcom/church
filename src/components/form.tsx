"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { IconCamera } from "./icons";

/** 제출 중에는 스스로 비활성화되는 버튼 */
export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingLabel = "저장 중…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** 브라우저 인쇄 창을 여는 버튼. PDF로 저장하면 그대로 보관용 문서가 된다. */
export function PrintButton({
  children = "인쇄 / PDF 저장",
  className = "btn btn-ghost",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {children}
    </button>
  );
}

/** 되돌릴 수 없는 동작에 확인창을 붙인 제출 버튼 */
export function ConfirmSubmitButton({
  children,
  message,
  className = "btn btn-danger",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

/**
 * 사진 업로드 필드.
 * 휴대폰에서는 카메라·갤러리를 바로 열 수 있고, 고른 사진을 즉시 미리 보여준다.
 */
export function PhotoInput({
  name,
  label = "사진",
  currentUrl,
  shape = "square",
  hint,
}: {
  name: string;
  label?: string;
  currentUrl?: string | null;
  shape?: "square" | "circle";
  hint?: string;
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const objectUrl = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    if (!file) {
      objectUrl.current = null;
      setPreview(currentUrl ?? null);
      return;
    }
    const url = URL.createObjectURL(file);
    objectUrl.current = url;
    setPreview(url);
  }

  const rounded = shape === "circle" ? "rounded-full" : "rounded-xl";

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-4">
        <div
          className={`flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border border-line-strong bg-surface-2 text-ink-3 ${rounded}`}
        >
          {preview ? (
            // 사용자가 올린 임의 경로의 이미지라 next/image 최적화 대신 기본 img를 쓴다.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <IconCamera width={26} height={26} />
          )}
        </div>
        <div className="min-w-0">
          <input
            ref={inputRef}
            id={`${name}-file`}
            type="file"
            name={name}
            accept="image/*"
            onChange={onChange}
            className="sr-only"
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => inputRef.current?.click()}
          >
            <IconCamera width={16} height={16} />
            사진 선택
          </button>
          <p className="mt-1.5 text-xs text-ink-3">
            {hint ?? "휴대폰에서는 카메라로 바로 촬영할 수 있습니다. (최대 8MB)"}
          </p>
          {currentUrl && (
            <label className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-2">
              <input type="checkbox" name={`${name}_remove`} value="1" /> 기존 사진 삭제
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 사진 여러 장을 한 번에 올리는 필드.
 * 고른 사진마다 설명을 달 수 있고, 올리기 전에 미리보기로 확인한다.
 */
export function PhotosInput({
  name = "photos",
  max = 10,
}: {
  name?: string;
  max?: number;
}) {
  const [files, setFiles] = useState<Array<{ url: string; fileName: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      for (const u of urls.current) URL.revokeObjectURL(u);
    };
  }, []);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    for (const u of urls.current) URL.revokeObjectURL(u);
    urls.current = [];

    const picked = Array.from(e.target.files ?? []).slice(0, max);
    setFiles(
      picked.map((f) => {
        const url = URL.createObjectURL(f);
        urls.current.push(url);
        return { url, fileName: f.name };
      }),
    );
  }

  return (
    <div>
      <span className="label">사진 (최대 {max}장)</span>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*"
        multiple
        onChange={onChange}
        className="sr-only"
      />
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => inputRef.current?.click()}
      >
        <IconCamera width={16} height={16} />
        {files.length > 0 ? `${files.length}장 선택됨 · 다시 고르기` : "사진 선택"}
      </button>
      <p className="mt-1.5 text-xs text-ink-3">
        휴대폰에서는 카메라로 바로 찍거나 앨범에서 여러 장을 고를 수 있습니다. (장당 8MB 이하)
      </p>

      {files.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((f) => (
            <li key={f.url}>
              <div className="aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface-2">
                {/* 아직 서버에 올라가지 않은 로컬 미리보기라 기본 img를 쓴다. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="" className="h-full w-full object-cover" />
              </div>
              <input
                type="text"
                name="photoCaption"
                className="field mt-1.5 text-xs"
                placeholder="사진 설명 (선택)"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 입력하는 동안 천 단위 구분기호를 보여주는 금액 필드 */
export function AmountInput({
  name,
  defaultValue,
  required,
  autoFocus,
  placeholder = "0",
}: {
  name: string;
  defaultValue?: number | null;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [display, setDisplay] = useState(
    defaultValue ? defaultValue.toLocaleString("ko-KR") : "",
  );

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        name={name}
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "");
          setDisplay(digits ? Number(digits).toLocaleString("ko-KR") : "");
        }}
        className="field tnum pr-9 text-right text-[1.05rem] font-semibold"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">
        원
      </span>
    </div>
  );
}
