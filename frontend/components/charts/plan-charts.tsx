"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InvestmentResult, Plan, StrategyReport } from "@/lib/types";
import { fmtIndex, fmtMoney, fmtPct } from "@/lib/format";
import { TooltipCard } from "./chart-tooltip";
import { LegendItem } from "./figure";
import { axisProps, gridProps, tipDatum, yAxisProps, type TipProps } from "./rc";

const C_PLAN = "var(--ink)";
const C_BAU = "var(--neutral-mark)";
const C_TARGET = "var(--saffron-mark)";

export interface TrajectoryPoint {
  year: string;
  plan: number;
  bau: number;
  target: number;
  fsfsi: number;
  envelope: number;
  on_track: boolean | null;
}

export function trajectoryRows(p: Plan): TrajectoryPoint[] {
  return [
    { year: p.base.year, plan: p.base.fsfsi_acc, bau: p.base.fsfsi_acc, target: p.base.fsfsi_acc, fsfsi: p.base.fsfsi, envelope: p.base.envelope, on_track: null },
    ...p.years.map((y) => ({
      year: y.year,
      plan: y.fsfsi_acc,
      bau: y.bau_fsfsi_acc,
      target: y.year_target,
      fsfsi: y.fsfsi,
      envelope: y.envelope,
      on_track: y.on_track,
    })),
  ];
}

/** Accumulated index under the plan, under today's composition, and the year-by-year target path. */
export function TrajectoryChart({ plan, height = 340 }: { plan: Plan; height?: number }) {
  const data = trajectoryRows(plan);
  const vals = data.flatMap((d) => [d.plan, d.bau, d.target]);
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 0.02) * 20) / 20);
  const hi = Math.ceil((Math.max(...vals) + 0.02) * 20) / 20;
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 12, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="year" {...axisProps} />
          <YAxis domain={[lo, hi]} {...yAxisProps} tickFormatter={(v: number) => v.toFixed(2)} />
          <ReferenceLine
            y={plan.target}
            stroke={C_TARGET}
            strokeDasharray="2 3"
            label={{ value: `Target ${fmtIndex(plan.target, 3)}`, position: "insideBottomLeft", fill: "var(--saffron-ink)", fontSize: 13 }}
          />
          <ReferenceLine x={plan.base.year} stroke="var(--rule-strong)" />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            content={(p: TipProps<TrajectoryPoint>) => {
              const d = tipDatum(p);
              if (!d) return null;
              return (
                <TooltipCard
                  title={d.on_track === null ? `${d.year} (latest assessed year)` : d.year}
                  rows={[
                    { label: "Plan, accumulated", value: fmtIndex(d.plan, 3), color: C_PLAN, strong: true },
                    { label: "Today's composition", value: fmtIndex(d.bau, 3), color: C_BAU, dashed: true },
                    { label: "Year target", value: fmtIndex(d.target, 3), color: C_TARGET, dashed: true },
                    { label: "Plan, this year only", value: fmtIndex(d.fsfsi, 3) },
                    { label: "Envelope", value: fmtMoney(d.envelope) },
                    ...(d.on_track === null ? [] : [{ label: "Status", value: d.on_track ? "On track" : "Above the year target" }]),
                  ]}
                />
              );
            }}
          />
          <Line dataKey="target" name="Year target" stroke={C_TARGET} strokeWidth={2} strokeDasharray="2 4" dot={false} isAnimationActive={false} />
          <Line
            dataKey="bau"
            name="Today's composition"
            stroke={C_BAU}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={{ r: 3.5, fill: "var(--canvas)", stroke: C_BAU, strokeWidth: 1.5 }}
            isAnimationActive={false}
          />
          <Line
            dataKey="plan"
            name="Plan"
            stroke={C_PLAN}
            strokeWidth={2.4}
            dot={{ r: 4.5, fill: C_PLAN, stroke: "var(--canvas)", strokeWidth: 1.5 }}
            activeDot={{ r: 6, fill: "var(--evergreen)", stroke: "var(--surface)" }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-5">
        <LegendItem label="Plan (optimal composition)" color={C_PLAN} />
        <LegendItem label="Same money, today's composition" color={C_BAU} dashed />
        <LegendItem label="Year-by-year target" color={C_TARGET} dotted />
      </div>
    </div>
  );
}

/** Envelope per year: the latest assessed year and each plan year, with the money added over the latest year. */
export function EnvelopeChart({ plan, currency, height = 260 }: { plan: Plan; currency: string; height?: number }) {
  const data = [
    { year: plan.base.year, envelope: plan.base.envelope, additional: 0 },
    ...plan.years.map((y) => ({ year: y.year, envelope: y.envelope, additional: y.additional })),
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="year" {...axisProps} />
        <YAxis {...yAxisProps} width={56} tickFormatter={(v: number) => fmtMoney(v, undefined, 0)} />
        <Tooltip
          cursor={{ fill: "var(--ink-4)" }}
          content={(p: TipProps<(typeof data)[number]>) => {
            const d = tipDatum(p);
            if (!d) return null;
            return (
              <TooltipCard
                title={d.year}
                rows={[
                  { label: "Envelope", value: fmtMoney(d.envelope, currency), strong: true },
                  { label: "Above the latest year", value: fmtMoney(d.additional, currency) },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="envelope" fill="var(--steel)" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
          <LabelList dataKey="envelope" position="top" formatter={(v: unknown) => fmtMoney(Number(v))} style={{ fill: "var(--ink-muted)", fontSize: 13 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Alignment of the actual allocation with the strategy's target split, year by year. */
export function AlignmentHistoryChart({ report, height = 260 }: { report: StrategyReport; height?: number }) {
  const data = report.history.map((h) => ({ year: h.year, alignment: h.alignment }));
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 12, right: 64, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="year" {...axisProps} />
          <YAxis domain={[0, 1]} {...yAxisProps} tickFormatter={(v: number) => fmtPct(v)} />
          <ReferenceLine
            y={report.alignment.plan}
            stroke="var(--steel)"
            strokeDasharray="2 3"
            label={{ value: `Plan ${fmtPct(report.alignment.plan)}`, position: "right", fill: "var(--steel)", fontSize: 13 }}
          />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            content={(p: TipProps<(typeof data)[number]>) => {
              const d = tipDatum(p);
              if (!d) return null;
              return <TooltipCard title={d.year} rows={[{ label: "Alignment", value: fmtPct(d.alignment, 1), color: "var(--ink)", strong: true }]} />;
            }}
          />
          <Line
            dataKey="alignment"
            stroke="var(--ink)"
            strokeWidth={2.4}
            dot={{ r: 4.5, fill: "var(--ink)", stroke: "var(--canvas)", strokeWidth: 1.5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-5">
        <LegendItem label="Actual allocation" />
        <LegendItem label="End of plan" color="var(--steel)" dotted />
      </div>
    </div>
  );
}

/** Accumulated index of the plan alone and of the plan with an investor programme on top. */
export function ProgrammePathChart({ r, height = 320 }: { r: InvestmentResult; height?: number }) {
  const data = r.plan.path;
  const vals = data.flatMap((d) => [d.plan_acc, d.with_acc, d.year_target]).concat(r.plan.target);
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 0.02) * 20) / 20);
  const hi = Math.ceil((Math.max(...vals) + 0.02) * 20) / 20;
  const lastPaid = [...data].reverse().find((d) => d.disbursed > 0)?.year;
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 12, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="year" {...axisProps} />
          <YAxis domain={[lo, hi]} {...yAxisProps} tickFormatter={(v: number) => v.toFixed(2)} />
          <ReferenceLine
            y={r.plan.target}
            stroke={C_TARGET}
            strokeDasharray="2 3"
            label={{ value: `Target ${fmtIndex(r.plan.target, 3)}`, position: "insideBottomLeft", fill: "var(--saffron-ink)", fontSize: 13 }}
          />
          {lastPaid ? (
            <ReferenceLine
              x={lastPaid}
              stroke="var(--rule-strong)"
              strokeDasharray="3 3"
              label={{ value: "Last disbursement", position: "insideTopRight", fill: "var(--ink-subtle)", fontSize: 13 }}
            />
          ) : null}
          <Tooltip
            cursor={{ stroke: "var(--line-strong)" }}
            content={(p: TipProps<(typeof data)[number]>) => {
              const d = tipDatum(p);
              if (!d) return null;
              return (
                <TooltipCard
                  title={d.year}
                  rows={[
                    { label: "Plan with the programme", value: fmtIndex(d.with_acc, 3), color: "var(--steel)", strong: true },
                    { label: "Plan alone", value: fmtIndex(d.plan_acc, 3), color: C_PLAN },
                    { label: "Difference", value: fmtIndex(d.plan_acc - d.with_acc, 4) },
                    { label: "Disbursed", value: fmtMoney(d.disbursed) },
                  ]}
                />
              );
            }}
          />
          <Line dataKey="plan_acc" stroke={C_PLAN} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3.5, fill: "var(--canvas)", stroke: C_PLAN, strokeWidth: 1.5 }} isAnimationActive={false} />
          <Line dataKey="with_acc" stroke="var(--steel)" strokeWidth={2.4} dot={{ r: 4.5, fill: "var(--steel)", stroke: "var(--canvas)", strokeWidth: 1.5 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-5">
        <LegendItem label="Plan with the programme" color="var(--steel)" />
        <LegendItem label="Plan alone" color={C_PLAN} dashed />
        <LegendItem label="Plan target" color={C_TARGET} dotted />
      </div>
    </div>
  );
}
