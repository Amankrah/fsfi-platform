"use client";

/** Shared Recharts styling helpers. */

export const axisProps = {
  tickLine: false,
  axisLine: { stroke: "var(--line-strong)" },
  tick: { fill: "var(--ink-subtle)", fontSize: 12 },
} as const;

export const yAxisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--ink-subtle)", fontSize: 12 },
  width: 44,
} as const;

export const gridProps = {
  stroke: "var(--line)",
  vertical: false,
  strokeDasharray: "0",
} as const;

export interface TipProps<P = unknown> {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: P; value?: unknown; dataKey?: unknown; name?: unknown; color?: string }>;
  label?: unknown;
}

/** First datum behind a tooltip. */
export function tipDatum<P>(p: TipProps<P>): P | undefined {
  if (!p.active || !p.payload?.length) return undefined;
  return p.payload[0]?.payload;
}
