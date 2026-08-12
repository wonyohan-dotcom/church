"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** 연도를 고르면 곧바로 해당 연도로 다시 조회한다. */
export function YearSelect({
  year,
  years,
  basePath,
}: {
  year: number;
  years: number[];
  basePath: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <select
      aria-label="조회 연도"
      className="field w-[7.5rem]"
      value={String(year)}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        next.set("year", e.target.value);
        router.push(`${basePath}?${next.toString()}`);
      }}
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}년
        </option>
      ))}
    </select>
  );
}
