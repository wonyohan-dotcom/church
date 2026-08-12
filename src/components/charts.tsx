"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { won } from "@/lib/format";

export type MonthlyPoint = { label: string; income: number; expense: number };

/** 축 눈금은 만원 단위로 줄여 자릿수 부담을 덜었다. */
function tickWon(v: number) {
  if (v === 0) return "0";
  if (Math.abs(v) >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만`;
  return v.toLocaleString("ko-KR");
}

type TooltipPayload = { name?: string; value?: number; color?: string };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5 shadow-[var(--shadow-lg)]">
      <p className="mb-1.5 text-xs font-semibold text-ink-3">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-sm">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: p.color }}
            aria-hidden
          />
          <span className="text-ink-2">{p.name}</span>
          <span className="tnum ml-auto pl-3 font-semibold text-ink">{won(p.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * 월별 수입·지출 비교.
 * 두 계열 모두 '원' 단위라 축은 하나만 쓴다. (이중 축은 쓰지 않는다)
 */
export function MonthlyIncomeExpenseChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <div>
      <div className="h-[16rem] w-full sm:h-[19rem]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barGap={2}>
            <CartesianGrid
              vertical={false}
              stroke="var(--chart-grid)"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--chart-grid)" }}
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={tickWon}
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "var(--surface-2)" }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={28}
              iconType="square"
              iconSize={9}
              formatter={(value) => (
                <span style={{ color: "var(--ink-2)", fontSize: 12 }}>{value}</span>
              )}
            />
            <Bar
              dataKey="income"
              name="수입"
              fill="var(--chart-income)"
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
            <Bar
              dataKey="expense"
              name="지출"
              fill="var(--chart-expense)"
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 색만으로 읽지 않아도 되도록 같은 데이터를 표로도 제공한다. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-ink-3 hover:text-ink">
          표로 보기
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>월</th>
                <th className="text-right">수입</th>
                <th className="text-right">지출</th>
                <th className="text-right">잔액</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  <td className="tnum text-right">{won(d.income)}</td>
                  <td className="tnum text-right">{won(d.expense)}</td>
                  <td className="tnum text-right font-semibold">{won(d.income - d.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/**
 * 항목별 금액 비교 — 크기를 읽는 것이 목적이라 한 가지 색만 쓴다.
 * 값을 막대 옆에 직접 적어 두어 별도 툴팁이 필요 없다.
 */
export function BreakdownBars({
  items,
  emptyText = "자료가 없습니다.",
}: {
  items: Array<{ name: string; amount: number }>;
  emptyText?: string;
}) {
  const max = Math.max(...items.map((i) => i.amount), 1);
  const total = items.reduce((s, i) => s + i.amount, 0);

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-3">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium text-ink">{i.name}</span>
            <span className="tnum shrink-0 text-sm font-semibold text-ink">
              {won(i.amount)}
              {total > 0 && (
                <span className="ml-1.5 text-xs font-medium text-ink-3">
                  {Math.round((i.amount / total) * 100)}%
                </span>
              )}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-chart-bar"
              style={{ width: `${Math.max((i.amount / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
