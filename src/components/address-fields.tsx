"use client";

import { useCallback, useRef, useState } from "react";
import { IconSearch } from "./icons";

/**
 * 다음(카카오) 우편번호 서비스를 이용한 주소 입력.
 *
 * 스크립트는 버튼을 처음 누를 때만 불러온다. 인터넷이 안 되거나 서비스가 막혀 있어도
 * 세 칸 모두 직접 입력할 수 있으니 주소를 못 넣는 상황은 생기지 않는다.
 */

const SCRIPT_SRC =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

type PostcodeResult = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName?: string;
  apartment?: "Y" | "N";
};

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: PostcodeResult) => void;
        onclose?: () => void;
      }) => { open: () => void };
    };
  }
}

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.daum?.Postcode) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${SCRIPT_SRC}"]`,
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject());
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject();
    document.head.appendChild(script);
  });
}

export function AddressFields({
  label = "주소",
  namePostal = "postalCode",
  nameAddress = "address",
  nameDetail = "addressDetail",
  defaultPostal = "",
  defaultAddress = "",
  defaultDetail = "",
  required = false,
}: {
  label?: string;
  namePostal?: string;
  nameAddress?: string;
  nameDetail?: string;
  defaultPostal?: string;
  defaultAddress?: string;
  defaultDetail?: string;
  required?: boolean;
}) {
  const [postal, setPostal] = useState(defaultPostal);
  const [address, setAddress] = useState(defaultAddress);
  const [detail, setDetail] = useState(defaultDetail);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const detailRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      await loadScript();
      if (!window.daum?.Postcode) throw new Error("스크립트를 불러오지 못했습니다.");

      new window.daum.Postcode({
        oncomplete: (data) => {
          // 아파트처럼 건물명이 있으면 도로명주소 뒤에 붙여 준다.
          const building =
            data.buildingName && data.apartment === "Y" ? ` (${data.buildingName})` : "";
          setPostal(data.zonecode);
          setAddress(`${data.roadAddress || data.jibunAddress}${building}`);
          // 이어서 동·호수를 적도록 커서를 옮겨 준다.
          setTimeout(() => detailRef.current?.focus(), 100);
        },
      }).open();
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div>
      <span className="label">
        {label}
        {required && <span className="ml-0.5 text-expense">*</span>}
      </span>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            name={namePostal}
            value={postal}
            onChange={(e) => setPostal(e.target.value)}
            className="field tnum w-32"
            placeholder="우편번호"
            inputMode="numeric"
            autoComplete="postal-code"
          />
          <button
            type="button"
            className="btn btn-ghost shrink-0"
            onClick={search}
            disabled={loading}
          >
            <IconSearch width={16} height={16} />
            {loading ? "여는 중…" : "주소 찾기"}
          </button>
        </div>

        <input
          name={nameAddress}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="field"
          placeholder="도로명 또는 지번 주소"
          required={required}
          autoComplete="street-address"
        />

        <input
          ref={detailRef}
          name={nameDetail}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          className="field"
          placeholder="상세 주소 (동·호수 등)"
          autoComplete="address-line2"
        />
      </div>

      {failed && (
        <p className="mt-1.5 text-xs text-warn">
          주소 검색 창을 열지 못했습니다. 인터넷 연결을 확인하시거나, 위 칸에 직접
          입력해 주세요.
        </p>
      )}
    </div>
  );
}
