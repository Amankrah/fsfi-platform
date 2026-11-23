"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PlanCurve, PlanParams } from "./types";

export const PLAN_DEFAULTS: PlanParams = { horizon: 5, target_reduction: 0.2, growth: 0.05, curve: "smoothstep", pace: 1 };
export const HORIZONS = [3, 5, 7, 10];
export const PACES = [0.25, 0.5, 1];
export const CURVES: { value: PlanCurve; label: string; hint: string }[] = [
  { value: "smoothstep", label: "Gradual", hint: "Slow start, fastest in the middle years, slow finish" },
  { value: "linear", label: "Even", hint: "The same reduction every year" },
  { value: "frontloaded", label: "Early", hint: "Most of the reduction in the first years" },
];

const KEYS: Record<keyof PlanParams, string> = {
  horizon: "h",
  target_reduction: "tr",
  growth: "g",
  curve: "curve",
  pace: "pace",
};

function num(v: string | null, lo: number, hi: number, fallback: number) {
  const x = v === null ? NaN : Number(v);
  return Number.isFinite(x) && x >= lo && x <= hi ? x : fallback;
}

/** Plan settings kept in the URL (?h=&tr=&g=&curve=&pace=) so the plan and the strategy page share them. */
export function usePlanParams(): PlanParams & { set: (patch: Partial<PlanParams>) => void; query: string } {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const params: PlanParams = useMemo(() => {
    const c = sp.get("curve") as PlanCurve | null;
    return {
      horizon: Math.round(num(sp.get("h"), 1, 15, PLAN_DEFAULTS.horizon)),
      target_reduction: num(sp.get("tr"), 0.01, 0.95, PLAN_DEFAULTS.target_reduction),
      growth: num(sp.get("g"), -0.2, 1, PLAN_DEFAULTS.growth),
      curve: c && CURVES.some((x) => x.value === c) ? c : PLAN_DEFAULTS.curve,
      pace: num(sp.get("pace"), 0.01, 1, PLAN_DEFAULTS.pace),
    };
  }, [sp]);

  const set = useCallback(
    (patch: Partial<PlanParams>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch) as [keyof PlanParams, PlanParams[keyof PlanParams]][]) {
        const key = KEYS[k];
        if (v === undefined || v === PLAN_DEFAULTS[k]) next.delete(key);
        else next.set(key, String(typeof v === "number" ? +v.toFixed(4) : v));
      }
      const s = next.toString();
      router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false });
    },
    [sp, router, pathname],
  );

  const query = useMemo(() => {
    const keep = new URLSearchParams();
    for (const k of ["year", "weighting", "scenario", "response", ...Object.values(KEYS)]) {
      const v = sp.get(k);
      if (v) keep.set(k, v);
    }
    const s = keep.toString();
    return s ? `?${s}` : "";
  }, [sp]);

  return { ...params, set, query };
}

export function planParamsOf(p: PlanParams): PlanParams {
  return { horizon: p.horizon, target_reduction: p.target_reduction, growth: p.growth, curve: p.curve, pace: p.pace };
}
