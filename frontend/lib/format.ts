const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Index values in [0,1] (FSFSI, E, stress, gap). */
export function fmtIndex(v: number | null | undefined, digits = 2) {
  return isNum(v) ? v.toFixed(digits) : "n/a";
}

/** Fractions as percentages. */
export function fmtPct(v: number | null | undefined, digits = 0) {
  return isNum(v) ? `${(v * 100).toFixed(digits)}%` : "n/a";
}

/** Percentage points, signed. */
export function fmtPp(v: number | null | undefined, digits = 1) {
  if (!isNum(v)) return "n/a";
  const s = v.toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits);
  return v > 0 ? `+${s}` : s.replace("-", "−");
}

export function fmtSigned(v: number | null | undefined, digits = 2) {
  if (!isNum(v)) return "n/a";
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits);
  return v > 0 ? `+${s}` : `−${s}`;
}

export function fmtMultiple(v: number | null | undefined, digits = 1) {
  return isNum(v) ? `${v.toFixed(digits)}×` : "n/a";
}

export function fmtMoney(v: number | null | undefined, currency?: string, digits?: number) {
  if (!isNum(v)) return "n/a";
  const d = digits ?? (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
  const s = v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  return currency ? `${s} ${currency}` : s;
}

export function fmtNum(v: number | null | undefined, digits = 2) {
  if (!isNum(v)) return "n/a";
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

/** Scientific notation for small or large magnitudes, e.g. 7.42×10⁻⁵. */
export function fmtSci(v: number | null | undefined, digits = 3) {
  if (!isNum(v)) return "n/a";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 0.01 && a < 1e4) return v.toPrecision(digits);
  const [m, e] = v.toExponential(digits - 1).split("e");
  const exp = String(Number(e)).split("").map((c) => SUP[c] ?? c).join("");
  return `${m}×10${exp}`;
}

export function fmtMs(v: number | null | undefined) {
  if (!isNum(v)) return "n/a";
  return v < 10 ? `${v.toFixed(2)} ms` : `${v.toFixed(0)} ms`;
}

export function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function scenarioLabel(s: string) {
  const map: Record<string, string> = {
    normal_operations: "Normal operations",
    climate_shock: "Climate shock",
    financial_crisis: "Financial crisis",
    pandemic_disruption: "Pandemic",
    pandemic: "Pandemic",
    political_instability: "Political instability",
  };
  return map[s] ?? titleCase(s);
}
