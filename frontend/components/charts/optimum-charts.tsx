"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Component, IndicatorResult } from "@/lib/types";
import { fmtPct, fmtSci } from "@/lib/format";
import { TooltipCard } from "./chart-tooltip";
import { axisProps, gridProps, tipDatum, yAxisProps, type TipProps } from "./rc";
import { LegendItem } from "./figure";

/** Share of the full index reduction captured vs share of the budget moved. */
export function FrontLoadedChart({
  points,
  at10,
  height = 320,
}: {
  points: { moved: number; captured: number }[];
  at10: number;
  height?: number;
}) {
  const sorted = [...points].sort((a, b) => a.moved - b.moved);
  const full = sorted.find((p) => p.captured >= 0.999)?.moved ?? 1;
  const maxMoved = Math.min(1, Math.max(0.3, Math.ceil((full + 0.1) * 10) / 10));
  const data = sorted.filter((p) => p.moved <= maxMoved + 1e-9).map((p) => ({ ...p, diag: p.moved }));
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 16, right: 16, bottom: 6, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis
            type="number"
            dataKey="moved"
            domain={[0, maxMoved]}
            {...axisProps}
            tickFormatter={(v: number) => fmtPct(v)}
            label={{ value: "Share of budget moved", position: "insideBottom", offset: -4, fill: "var(--ink-78)", fontSize: 12 }}
            height={40}
          />
          <YAxis domain={[0, 1]} {...yAxisProps} tickFormatter={(v: number) => fmtPct(v)} />
          <Line dataKey="diag" stroke="var(--neutral-mark)" strokeWidth={1} dot={false} activeDot={false} isAnimationActive={false} />
          <ReferenceLine x={0.1} stroke="var(--ink-40)" strokeDasharray="2 3" />
          <ReferenceLine y={at10} stroke="var(--ink-40)" strokeDasharray="2 3" />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            content={(p: TipProps<{ moved: number; captured: number }>) => {
              const d = tipDatum(p);
              return d ? (
                <TooltipCard
                  rows={[
                    { label: "Budget moved", value: fmtPct(d.moved, 1) },
                    { label: "Reduction captured", value: fmtPct(d.captured, 1), strong: true },
                  ]}
                />
              ) : null;
            }}
          />
          <Line
            dataKey="captured"
            type="monotone"
            stroke="var(--ink)"
            strokeWidth={2.4}
            dot={false}
            activeDot={{ r: 5, fill: "var(--evergreen)", stroke: "var(--surface)" }}
          />
          <ReferenceDot
            x={0.1}
            y={at10}
            r={6}
            fill="var(--saffron)"
            stroke="var(--evergreen)"
            strokeWidth={1.4}
            label={{ value: fmtPct(at10), position: "right", fill: "var(--ink)", fontSize: 12, offset: 12 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-5">
        <LegendItem label="Optimal path" />
        <LegendItem label="Proportional" color="var(--neutral-mark)" />
      </div>
    </div>
  );
}

/**
 * Marginal return per indicator at the actual allocation, against the common
 * return level of the optimum. Bars above it would gain money; below would give it up.
 */
export function MarginalReturnsChart({
  indicators,
  lambda,
  components,
  height = 380,
}: {
  indicators: IndicatorResult[];
  lambda: number;
  components: Component[];
  height?: number;
}) {
  const names = Object.fromEntries(components.map((c) => [c.id, c.name]));
  const data = [...indicators]
    .filter((d) => Number.isFinite(d.marginal_return))
    .sort((a, b) => b.marginal_return - a.marginal_return)
    .map((d) => ({ ...d, above: d.marginal_return > lambda }));
  const max = Math.max(lambda * 1.6, ...data.map((d) => d.marginal_return));
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 18, right: 16, bottom: 4, left: 4 }} barCategoryGap={2}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="code" {...axisProps} interval={0} angle={-60} textAnchor="end" height={64} tick={{ fill: "var(--ink-78)", fontSize: 10, fontFamily: "var(--font-mono)" }} />
          <YAxis scale="sqrt" domain={[0, max]} {...yAxisProps} width={8} tick={false} />
          <Tooltip
            cursor={{ fill: "var(--ink-4)" }}
            content={(p: TipProps<IndicatorResult & { above: boolean }>) => {
              const d = tipDatum(p);
              return d ? (
                <TooltipCard
                  title={d.name}
                  rows={[
                    { label: "Component", value: names[d.component] ?? d.component },
                    { label: "Marginal return", value: fmtSci(d.marginal_return), strong: true },
                    { label: "Share, actual → optimal", value: `${fmtPct(d.share, 1)} → ${fmtPct(d.optimal_share, 1)}` },
                  ]}
                  footer={d.above ? "Gains money at the optimum" : "Gives money up at the optimum"}
                />
              ) : null;
            }}
          />
          <Bar dataKey="marginal_return" radius={[3, 3, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.code} fill={d.above ? "var(--evergreen)" : "var(--neutral-mark)"} />
            ))}
          </Bar>
          <ReferenceLine
            y={lambda}
            stroke="var(--saffron)"
            strokeWidth={2}
            label={{ value: "Common return level", position: "insideTopRight", fill: "var(--saffron-ink)", fontSize: 12, fontWeight: 600 }}
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-5">
        <LegendItem marker={<span className="size-3 bg-evergreen" />} label="Would gain money" />
        <LegendItem marker={<span className="size-3 bg-neutral-mark" />} label="Would give money up" />
        <LegendItem color="var(--saffron)" label="Common return level" />
      </div>
    </div>
  );
}
