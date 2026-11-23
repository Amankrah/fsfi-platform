import type { Diagnosis, StressClass, Weighting, ResponseForm } from "./types";

/* Stress classes and diagnosis labels: spec §5. */

export const STRESS_CLASSES: StressClass[] = ["low", "medium", "high", "critical"];

export const stressColor: Record<StressClass, string> = {
  low: "var(--stress-low)",
  medium: "var(--stress-medium)",
  high: "var(--stress-high)",
  critical: "var(--stress-critical)",
};

export const stressLabel: Record<StressClass, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const DIAGNOSES: Diagnosis[] = ["unfunded_gap", "partially_funded_gap", "funded_gap", "at_benchmark"];

export const diagnosisColor: Record<Diagnosis, string> = {
  at_benchmark: "var(--dx-at_benchmark)",
  partially_funded_gap: "var(--dx-partially_funded_gap)",
  funded_gap: "var(--dx-funded_gap)",
  unfunded_gap: "var(--dx-unfunded_gap)",
};

/** Text colour that stays legible on top of the diagnosis fill. */
export const diagnosisOnColor: Record<Diagnosis, string> = {
  at_benchmark: "#ffffff",
  partially_funded_gap: "#ffffff",
  funded_gap: "#ffffff",
  unfunded_gap: "#ffffff",
};

export const diagnosisLabel: Record<Diagnosis, string> = {
  at_benchmark: "At or near benchmark",
  unfunded_gap: "Unfunded gap",
  partially_funded_gap: "Partially funded gap",
  funded_gap: "Funded gap",
};

export const diagnosisShort: Record<Diagnosis, string> = {
  at_benchmark: "At benchmark",
  unfunded_gap: "Unfunded",
  partially_funded_gap: "Partially funded",
  funded_gap: "Funded",
};

export const diagnosisBlurb: Record<Diagnosis, string> = {
  unfunded_gap: "A shortfall that money has not reached.",
  partially_funded_gap: "Some money, some gap.",
  funded_gap: "Well funded, yet the shortfall persists.",
  at_benchmark: "Already at or near its benchmark.",
};

export const WEIGHTINGS: { value: Weighting; label: string; hint: string }[] = [
  { value: "hybrid", label: "Hybrid", hint: "Expert, network and budget views combined" },
  { value: "equal", label: "Equal", hint: "Every indicator counts the same" },
  { value: "expert", label: "Expert", hint: "Expert pairwise judgements" },
  { value: "network", label: "Network", hint: "How components depend on each other" },
  { value: "financial", label: "Budget share", hint: "Proportional to budget share" },
];

export const RESPONSES: { value: ResponseForm; label: string }[] = [
  { value: "exponential", label: "Exponential" },
  { value: "hyperbolic", label: "Hyperbolic" },
];

/* ----------------------------------------------------- component encodings
   Eight components are told apart by an evergreen tint ramp plus a marker
   shape, never by new hues. Order follows the framework's component order. */

export type MarkerShape =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "triangleDown"
  | "plus"
  | "cross"
  | "pentagon";

const SHAPES: MarkerShape[] = ["circle", "square", "triangle", "diamond", "triangleDown", "plus", "cross", "pentagon"];

/** Tint ramp alternates dark/light so neighbours stay distinguishable. */
const TINTS = [100, 40, 78, 25, 90, 55, 66, 32];

export interface ComponentStyle {
  index: number;
  shape: MarkerShape;
  tint: number;
  fill: string;
}

export function componentStyle(index: number): ComponentStyle {
  const i = ((index % SHAPES.length) + SHAPES.length) % SHAPES.length;
  const tint = TINTS[i];
  return {
    index,
    shape: SHAPES[i],
    tint,
    fill: tint >= 100 ? "var(--ink)" : `color-mix(in oklab, var(--ink) ${tint}%, var(--canvas))`,
  };
}

export function componentStyleMap(ids: string[]): Record<string, ComponentStyle> {
  const out: Record<string, ComponentStyle> = {};
  ids.forEach((id, i) => (out[id] = componentStyle(i)));
  return out;
}

/** Year ramp for multi-year line charts: older years lighter, latest full ink. */
export function yearTint(i: number, n: number) {
  if (n <= 1) return "var(--ink)";
  const t = Math.round(22 + (i / (n - 1)) * 78);
  return t >= 100 ? "var(--ink)" : `color-mix(in oklab, var(--ink) ${t}%, var(--canvas))`;
}

export function inkMix(pct: number) {
  return `color-mix(in oklab, var(--ink) ${pct}%, var(--canvas))`;
}

/**
 * Sequential heat ramp for matrices (0..1): one hue, evergreen over white. The middle of the ramp is skipped so every
 * cell keeps at least 4.5:1 for its number (ink on the light half, white on the dark half).
 */
function heatMix(v: number, max: number) {
  const t = Math.max(0, Math.min(1, max > 0 ? v / max : 0));
  return t < 0.5 ? Math.round(6 + t * 90) : Math.round(75 + (t - 0.5) * 50);
}

export function heatColor(v: number, max = 1) {
  return `color-mix(in srgb, var(--evergreen) ${heatMix(v, max)}%, #ffffff)`;
}

export function heatTextColor(v: number, max = 1) {
  return heatMix(v, max) >= 75 ? "#ffffff" : "var(--ink)";
}
