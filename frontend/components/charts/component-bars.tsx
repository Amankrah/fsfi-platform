"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ComponentResult } from "@/lib/types";
import { DIAGNOSES, diagnosisColor, diagnosisLabel, diagnosisShort } from "@/lib/encodings";
import { fmtIndex, fmtPct, fmtPp } from "@/lib/format";
import { TooltipCard } from "./chart-tooltip";
import { LegendItem } from "./figure";
import { axisProps, type TipProps } from "./rc";

const yTick = { fill: "var(--ink)", fontSize: 13 } as const;

function useNarrow() {
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

/** SortedBar: component stress, ranked, coloured by diagnosis class with the class written beside each bar. */
export function ComponentStressBars({ rows }: { rows: ComponentResult[] }) {
  const narrow = useNarrow();
  const data = [...rows].sort((a, b) => b.stress - a.stress).map((r) => ({ ...r, label: `${fmtIndex(r.stress)}  ${diagnosisShort[r.diagnosis]}` }));
  const present = DIAGNOSES.filter((d) => rows.some((r) => r.diagnosis === d));
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1">
        {present.map((d) => (
          <LegendItem
            key={d}
            marker={
              <span
                className="size-3"
                style={d === "at_benchmark" ? { border: `2px solid ${diagnosisColor[d]}` } : { background: diagnosisColor[d] }}
              />
            }
            label={diagnosisLabel[d]}
          />
        ))}
      </div>
      <ResponsiveContainer width="100%" height={data.length * 38 + 40}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: narrow ? 96 : 150, bottom: 4, left: 4 }} barCategoryGap="28%" accessibilityLayer>
          <CartesianGrid stroke="var(--rule)" horizontal={false} />
          <XAxis type="number" domain={[0, (max: number) => Math.min(1, Math.ceil(max * 10) / 10 + 0.05)]} tickFormatter={(v: number) => v.toFixed(1)} {...axisProps} />
          <YAxis type="category" dataKey="name" width={narrow ? 110 : 190} tickLine={false} axisLine={{ stroke: "var(--rule-strong)" }} tick={yTick} />
          <Tooltip
            cursor={{ fill: "var(--ink-4)" }}
            content={(p: TipProps<ComponentResult>) => {
              const d = p.active ? p.payload?.[0]?.payload : undefined;
              if (!d) return null;
              return (
                <TooltipCard
                  title={d.name}
                  rows={[
                    { label: "Stress", value: fmtIndex(d.stress, 3), strong: true },
                    { label: "Mean gap", value: fmtIndex(d.mean_gap) },
                    { label: "Coverage", value: fmtIndex(d.coverage) },
                    { label: "Budget share", value: fmtPct(d.share, 1) },
                    { label: "Diagnosis", value: diagnosisShort[d.diagnosis] },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="stress" isAnimationActive={false}>
            {data.map((r) => (
              <Cell
                key={r.id}
                fill={r.diagnosis === "at_benchmark" ? "var(--surface)" : diagnosisColor[r.diagnosis]}
                stroke={diagnosisColor[r.diagnosis]}
                strokeWidth={r.diagnosis === "at_benchmark" ? 2 : 0}
              />
            ))}
            <LabelList dataKey="label" position="right" style={{ fill: "var(--ink)", fontSize: 13 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** DivergingBar: shift in budget share at the optimum. Gain to the right, loss to the left, zero emphasised. */
export function ReallocationBars({ rows }: { rows: ComponentResult[] }) {
  const narrow = useNarrow();
  const data = [...rows].sort((a, b) => b.shift_pp - a.shift_pp).map((r) => ({ ...r, label: `${fmtPp(r.shift_pp)} pp` }));
  const m = Math.max(1, ...data.map((d) => Math.abs(d.shift_pp)));
  const lim = Math.ceil(m / 5) * 5;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1">
        <LegendItem marker={<span className="size-3 bg-steel" />} label="Receives more at the optimum" />
        <LegendItem marker={<span className="size-3" style={{ background: "var(--neutral-mark)" }} />} label="Gives up share" />
      </div>
      <ResponsiveContainer width="100%" height={data.length * 38 + 40}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }} barCategoryGap="28%" accessibilityLayer>
          <CartesianGrid stroke="var(--rule)" horizontal={false} />
          <XAxis type="number" domain={[-lim, lim]} tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}`} {...axisProps} />
          <YAxis type="category" dataKey="name" width={narrow ? 110 : 190} tickLine={false} axisLine={false} tick={yTick} />
          <ReferenceLine x={0} stroke="var(--ink)" strokeWidth={1.5} />
          <Tooltip
            cursor={{ fill: "var(--ink-4)" }}
            content={(p: TipProps<ComponentResult>) => {
              const d = p.active ? p.payload?.[0]?.payload : undefined;
              if (!d) return null;
              return (
                <TooltipCard
                  title={d.name}
                  rows={[
                    { label: "Current share", value: fmtPct(d.share, 1) },
                    { label: "Optimal share", value: fmtPct(d.optimal_share, 1) },
                    { label: "Shift", value: `${fmtPp(d.shift_pp)} pp`, strong: true },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="shift_pp" isAnimationActive={false}>
            {data.map((r) => (
              <Cell key={r.id} fill={r.shift_pp >= 0 ? "var(--steel)" : "var(--neutral-mark)"} />
            ))}
            <LabelList dataKey="label" position="right" style={{ fill: "var(--ink)", fontSize: 13 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
