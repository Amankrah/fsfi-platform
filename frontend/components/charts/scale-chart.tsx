"use client";

import * as React from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ResponseForm, ScaleCurves } from "@/lib/types";
import { yearTint } from "@/lib/encodings";
import { fmtIndex, fmtMultiple, fmtSigned } from "@/lib/format";
import { TooltipCard } from "./chart-tooltip";
import { axisProps, gridProps, yAxisProps, type TipProps } from "./rc";

const TICKS = [0.1, 0.2, 0.5, 1, 2, 4, 8];

/**
 * Efficiency against budget size (log axis) for each year's mix. Open circles
 * mark each year at its own budget; the dashed tangent shows the local slope.
 */
export function ScaleChart({
  scale,
  response,
  height = 440,
  highlight,
}: {
  scale: ScaleCurves;
  response: ResponseForm;
  height?: number;
  highlight?: string | null;
}) {
  const curves = scale.curves.filter((c) => c.response === response);
  const years = curves.map((c) => c.year);
  const ref = curves.find((c) => c.year === scale.reference_year) ?? curves[curves.length - 1];

  const data = scale.multiples.map((m, i) => {
    const row: Record<string, number> = { m };
    curves.forEach((c) => (row[c.year] = c.efficiency[i]));
    return row;
  });

  const own = curves.map((c) => ({ m: c.own_multiple, e: c.own_efficiency, year: c.year }));

  const tangent = ref
    ? (() => {
        const m0 = ref.own_multiple;
        const e0 = ref.own_efficiency;
        const eps = ref.elasticity;
        return [m0 / 3, m0, m0 * 3]
          .map((m) => ({ m, t: e0 + e0 * eps * Math.log(m / m0) }))
          .filter((p) => p.m >= 0.1 && p.m <= 8);
      })()
    : [];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 16, right: 56, bottom: 8, left: 0 }}>
        <CartesianGrid {...gridProps} vertical horizontal />
        <XAxis
          type="number"
          dataKey="m"
          scale="log"
          domain={[0.1, 8]}
          ticks={TICKS}
          allowDataOverflow
          {...axisProps}
          tickFormatter={(v: number) => `${v}×`}
          label={{ value: `Budget, multiple of ${scale.reference_year}`, position: "insideBottom", offset: -4, fill: "var(--ink-78)", fontSize: 12 }}
          height={44}
        />
        <YAxis domain={[0, 1]} {...yAxisProps} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tickFormatter={(v: number) => v.toFixed(1)} />
        <ReferenceLine x={1} stroke="var(--ink-25)" strokeDasharray="2 3" />
        <Tooltip
          cursor={{ stroke: "var(--line-strong)" }}
          content={(p: TipProps<Record<string, number>>) => {
            if (!p.active || !p.payload?.length) return null;
            const d = p.payload[0]?.payload;
            if (!d || d.m === undefined) return null;
            return (
              <TooltipCard
                title={`${fmtMultiple(d.m, 2)} the ${scale.reference_year} budget`}
                rows={[...years].reverse().map((y) => ({
                  label: `${y} mix`,
                  value: fmtIndex(d[y], 3),
                  strong: y === ref?.year,
                }))}
              />
            );
          }}
        />
        {curves.map((c, i) => {
          const isRef = c.year === ref?.year;
          const dim = highlight && highlight !== c.year;
          return (
            <Line
              key={c.year}
              dataKey={c.year}
              type="monotone"
              dot={false}
              activeDot={isRef ? { r: 4, fill: "var(--saffron)", stroke: "var(--evergreen)" } : false}
              stroke={isRef ? "var(--ink)" : yearTint(i, curves.length + 1)}
              strokeWidth={isRef ? 2.6 : 1.4}
              strokeOpacity={dim ? 0.25 : 1}
              label={
                isRef || i === 0
                  ? (props: { x?: number | string; y?: number | string; index?: number }) =>
                      props.index === data.length - 1 ? (
                        <text x={Number(props.x) + 6} y={Number(props.y)} dy="0.35em" fontSize={12} fill="var(--ink-78)">
                          {c.year}
                        </text>
                      ) : (
                        <g />
                      )
                  : undefined
              }
            />
          );
        })}
        {tangent.length >= 2 ? (
          <Scatter
            data={tangent}
            dataKey="t"
            line={{ stroke: "var(--saffron)", strokeWidth: 2, strokeDasharray: "6 4" }}
            shape={() => <g />}
            isAnimationActive={false}
            legendType="none"
          />
        ) : null}
        <Scatter
          data={own}
          dataKey="e"
          line={{ stroke: "var(--ink-55)", strokeWidth: 1.2, strokeDasharray: "1.5 3" }}
          shape={(props: { cx?: number; cy?: number; payload?: { year: string } }) => {
            const isRef = props.payload?.year === ref?.year;
            return (
              <circle
                cx={props.cx}
                cy={props.cy}
                r={isRef ? 6 : 4.5}
                fill="var(--canvas)"
                stroke={isRef ? "var(--saffron)" : "var(--ink)"}
                strokeWidth={isRef ? 2.2 : 1.4}
              />
            );
          }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function scaleHeadline(scale: ScaleCurves, response: ResponseForm) {
  const c = scale.curves.find((x) => x.response === response && x.year === scale.reference_year);
  if (!c) return null;
  const first = c.efficiency[0];
  const last = c.efficiency[c.efficiency.length - 1];
  return {
    elasticity: fmtSigned(c.elasticity),
    from: fmtIndex(first),
    to: fmtIndex(last),
    own: fmtIndex(c.own_efficiency),
  };
}
