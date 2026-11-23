"use client";

import * as React from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  Bar,
  BarChart,
  LabelList,
} from "recharts";
import type { Breaks, TimeSeries, TimeSeriesYear } from "@/lib/types";
import { fmtIndex, fmtPct } from "@/lib/format";
import { TooltipCard } from "./chart-tooltip";
import { axisProps, gridProps, tipDatum, yAxisProps, type TipProps } from "./rc";
import { LegendItem } from "./figure";
import { DIAGNOSES, diagnosisColor, diagnosisShort } from "@/lib/encodings";

const bandFill = ["var(--ink-4)", "var(--ink-8)", "var(--ink-16)", "var(--saffron-20)"];
const bandName = ["Low", "Medium", "High", "Critical"];

/** Point-in-time vs accumulated index against stress-class bands. */
export function IndexRecordChart({
  ts,
  breaks,
  height = 320,
  compact,
}: {
  ts: TimeSeries;
  breaks: Breaks;
  height?: number;
  compact?: boolean;
}) {
  const b = breaks.system.length >= 3 ? breaks.system : breaks.indicator;
  const max = Math.max(0.5, ...ts.years.flatMap((y) => [y.fsfsi, y.fsfsi_acc])) * 1.12;
  const top = Math.min(1, Math.ceil(max * 10) / 10);
  const edges = [0, b[0], b[1], b[2], 1];
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={ts.years} margin={{ top: 10, right: compact ? 8 : 64, bottom: 0, left: 0 }}>
          {edges.slice(0, 4).map((lo, i) =>
            lo < top ? (
              <ReferenceArea
                key={i}
                y1={lo}
                y2={Math.min(edges[i + 1], top)}
                fill={bandFill[i]}
                fillOpacity={1}
                strokeOpacity={0}
                ifOverflow="hidden"
                label={
                  compact
                    ? undefined
                    : { value: bandName[i], position: "right", fill: "var(--ink-78)", fontSize: 13 }
                }
              />
            ) : null,
          )}
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="year" {...axisProps} />
          <YAxis domain={[0, top]} {...yAxisProps} tickFormatter={(v: number) => v.toFixed(2)} />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            content={(p: TipProps<TimeSeriesYear>) => {
              const d = tipDatum(p);
              if (!d) return null;
              return (
                <TooltipCard
                  title={d.year}
                  rows={[
                    { label: "This year", value: fmtIndex(d.fsfsi, 3), color: "var(--ivory)", strong: true },
                    { label: "Accumulated", value: fmtIndex(d.fsfsi_acc, 3), color: "var(--ivory)", dashed: true },
                    { label: "Assessed / imputed", value: `${d.n_assessed} / ${d.n_imputed}` },
                  ]}
                />
              );
            }}
          />
          <Line
            dataKey="fsfsi_acc"
            name="Accumulated"
            stroke="var(--ink-55)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 4, fill: "var(--canvas)", stroke: "var(--ink-55)", strokeWidth: 1.5 }}
          />
          <Line
            dataKey="fsfsi"
            name="Stress index"
            stroke="var(--ink)"
            strokeWidth={2.4}
            dot={{ r: 4.5, fill: "var(--ink)", stroke: "var(--canvas)", strokeWidth: 1.5 }}
            activeDot={{ r: 6, fill: "var(--evergreen)", stroke: "var(--surface)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      {!compact ? (
        <div className="mt-2 flex flex-wrap gap-5">
          <LegendItem label="This year" />
          <LegendItem label="Accumulated" color="var(--ink-55)" dashed />
        </div>
      ) : null}
    </div>
  );
}

/** Budget size, first year = 100. */
export function EnvelopeIndexChart({ ts, height = 240 }: { ts: TimeSeries; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={ts.years} margin={{ top: 22, right: 24, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="year" {...axisProps} />
        <YAxis {...yAxisProps} domain={[0, "auto"]} />
        <ReferenceLine y={100} stroke="var(--ink-40)" strokeDasharray="2 3" />
        <Tooltip
          cursor={{ stroke: "var(--line-strong)" }}
          content={(p: TipProps<TimeSeriesYear>) => {
            const d = tipDatum(p);
            return d ? <TooltipCard title={d.year} rows={[{ label: "Budget index", value: d.envelope_index.toFixed(1), strong: true }]} /> : null;
          }}
        />
        <Area dataKey="envelope_index" stroke="var(--ink)" strokeWidth={2} fill="var(--ink-6)" dot={{ r: 3.5, fill: "var(--ink)", stroke: "var(--canvas)" }}>
          <LabelList dataKey="envelope_index" position="top" offset={10} formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(0) : "")} style={{ fill: "var(--ink-78)", fontSize: 13 }} />
        </Area>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Actual efficiency vs efficiency at the first-year budget. */
export function EfficiencyRecordChart({ ts, height = 240 }: { ts: TimeSeries; height?: number }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={ts.years} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="year" {...axisProps} />
          <YAxis domain={[0, 1.05]} {...yAxisProps} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => v.toFixed(2)} />
          <ReferenceLine y={1} stroke="var(--rule-strong)" strokeDasharray="1.5 3" label={{ value: "Optimum", position: "insideTopRight", fill: "var(--ink-78)", fontSize: 13 }} />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            content={(p: TipProps<TimeSeriesYear>) => {
              const d = tipDatum(p);
              return d ? (
                <TooltipCard
                  title={d.year}
                  rows={[
                    { label: "Actual", value: fmtIndex(d.efficiency, 3), color: "var(--ink)", strong: true },
                    { label: "At first-year budget", value: fmtIndex(d.efficiency_fixed_t0, 3), color: "var(--ink-55)", dashed: true },
                  ]}
                />
              ) : null;
            }}
          />
          <Line dataKey="efficiency_fixed_t0" stroke="var(--ink-55)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3.5, fill: "var(--canvas)", stroke: "var(--ink-55)" }} />
          <Line dataKey="efficiency" stroke="var(--ink)" strokeWidth={2.4} dot={{ r: 4, fill: "var(--ink)", stroke: "var(--canvas)" }} activeDot={{ r: 6, fill: "var(--saffron)" }} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-5">
        <LegendItem label="Actual" />
        <LegendItem label="At first-year budget" color="var(--ink-55)" dashed />
      </div>
    </div>
  );
}

/** Envelope and stress shares of the unfunded label, by year. */
export function DiagnosisByYearChart({ ts, height = 260 }: { ts: TimeSeries; height?: number }) {
  const data = ts.years.map((y) => {
    const row: Record<string, number | string> = { year: y.year };
    for (const d of DIAGNOSES) {
      const s = y.diagnosis_summary.find((x) => x.diagnosis === d);
      row[`env_${d}`] = s?.envelope_share ?? 0;
      row[`str_${d}`] = s?.stress_share ?? 0;
    }
    return row;
  });
  const long = data.flatMap((r) => [
    { ...r, key: `${r.year} · budget`, kind: "env" },
    { ...r, key: `${r.year} · stress`, kind: "str" },
  ]);
  return (
    <div>
    <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1">
      {DIAGNOSES.map((dx) => (
        <LegendItem key={dx} marker={<span className="size-3" style={{ background: diagnosisColor[dx] }} />} label={diagnosisShort[dx]} />
      ))}
    </div>
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={long} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap={3}>
        <XAxis type="number" domain={[0, 1]} {...axisProps} tickFormatter={(v: number) => fmtPct(v)} />
        <YAxis type="category" dataKey="key" {...yAxisProps} width={92} interval={0} />
        <Tooltip
          cursor={{ fill: "var(--ink-4)" }}
          content={(p: TipProps<Record<string, number | string>>) => {
            const d = tipDatum(p);
            if (!d) return null;
            const kind = d.kind as string;
            return (
              <TooltipCard
                title={String(d.key)}
                rows={DIAGNOSES.map((dx) => ({
                  label: diagnosisShort[dx],
                  value: fmtPct(Number(d[`${kind}_${dx}`]), 1),
                  color: diagnosisColor[dx],
                }))}
              />
            );
          }}
        />
        {DIAGNOSES.map((dx) => (
          <Bar key={dx} dataKey={(r: Record<string, number | string>) => r[`${r.kind}_${dx}`] as number} stackId="a" fill={diagnosisColor[dx]} stroke="var(--surface)" strokeWidth={1} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}

/** Small multiple of the stress shares for the "unfunded gap" label by year. */
export function UnfundedTrend({ ts }: { ts: TimeSeries }) {
  const rows = ts.years.map((y) => {
    const s = y.diagnosis_summary.find((x) => x.diagnosis === "unfunded_gap");
    return { year: y.year, env: s?.envelope_share ?? 0, str: s?.stress_share ?? 0 };
  });
  return (
    <div className="space-y-2">
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1">
        <LegendItem marker={<span className="size-3 bg-steel" />} label="Share of budget" />
        <LegendItem marker={<span className="size-3 bg-evergreen" />} label="Share of stress" />
      </div>
      {rows.map((r) => (
        <div key={r.year} className="grid grid-cols-[44px_1fr] items-center gap-3 text-micro tabular">
          <span className="text-ink-muted">{r.year}</span>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-2.5 bg-steel" style={{ width: `${r.env * 80}%`, minWidth: 2 }} />
              <span className="text-ink-muted">{fmtPct(r.env)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 bg-evergreen" style={{ width: `${r.str * 80}%`, minWidth: 2 }} />
              <span className="font-medium">{fmtPct(r.str)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
