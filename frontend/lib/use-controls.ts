"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Controls, ResponseForm, Weighting } from "./types";

const WEIGHTINGS: Weighting[] = ["hybrid", "equal", "expert", "network", "financial"];
const RESPONSES: ResponseForm[] = ["exponential", "hyperbolic"];

/** URL-synced assessment controls: ?year=&weighting=&scenario=&response= */
export function useControls(): Controls & {
  set: (patch: Partial<Controls>) => void;
  query: string;
} {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const year = sp.get("year") ?? undefined;
  const w = sp.get("weighting") as Weighting | null;
  const r = sp.get("response") as ResponseForm | null;
  const weighting: Weighting = w && WEIGHTINGS.includes(w) ? w : "hybrid";
  const response: ResponseForm = r && RESPONSES.includes(r) ? r : "exponential";
  const scenario = sp.get("scenario") || "normal_operations";

  const set = useCallback(
    (patch: Partial<Controls>) => {
      const next = new URLSearchParams(sp.toString());
      const defaults: Record<string, string> = {
        weighting: "hybrid",
        response: "exponential",
        scenario: "normal_operations",
      };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "" || defaults[k] === v) next.delete(k);
        else next.set(k, String(v));
      }
      const s = next.toString();
      router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false });
    },
    [sp, router, pathname],
  );

  const query = useMemo(() => {
    const keep = new URLSearchParams();
    for (const k of ["year", "weighting", "scenario", "response", "h", "tr", "g", "curve", "pace"]) {
      const v = sp.get(k);
      if (v) keep.set(k, v);
    }
    const s = keep.toString();
    return s ? `?${s}` : "";
  }, [sp]);

  return { year, weighting, scenario, response, set, query };
}

/** Generic single URL param state. */
export function useUrlParam(key: string, fallback = ""): [string, (v: string) => void] {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = sp.get(key) ?? fallback;
  const set = useCallback(
    (v: string) => {
      const next = new URLSearchParams(sp.toString());
      if (!v || v === fallback) next.delete(key);
      else next.set(key, v);
      const s = next.toString();
      router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false });
    },
    [sp, router, pathname, key, fallback],
  );
  return [value, set];
}
