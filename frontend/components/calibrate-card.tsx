"use client";

import * as React from "react";
import { useSWRConfig } from "swr";
import { Check, Loader2, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import type { Breaks, CalibrateResult, Controls } from "@/lib/types";
import { Card, CardBody, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { Table, Td, Th, Tr } from "./ui/table";
import { ErrorState } from "./states";

const ROWS: { key: keyof Breaks; label: string; gvf?: "indicator" | "component" | "coverage" }[] = [
  { key: "indicator", label: "Indicator stress", gvf: "indicator" },
  { key: "component", label: "Component stress", gvf: "component" },
  { key: "system", label: "System index" },
  { key: "coverage", label: "Coverage", gvf: "coverage" },
];

const fmt = (b: number[]) => b.map((v) => v.toFixed(3)).join(" / ");

/** Recalibrates the class breaks from a custom country's own record (POST /calibrate). */
export function CalibrateCard({ id, controls, current }: { id: string; controls: Controls; current: Breaks }) {
  const { mutate } = useSWRConfig();
  const [res, setRes] = React.useState<CalibrateResult | null>(null);
  const [busy, setBusy] = React.useState<"run" | "apply" | null>(null);
  const [err, setErr] = React.useState<unknown>(null);

  const run = async (apply: boolean) => {
    setBusy(apply ? "apply" : "run");
    setErr(null);
    try {
      const r = await api.calibrate(id, {
        weighting: controls.weighting,
        scenario: controls.scenario,
        response: controls.response,
        apply,
      });
      setRes(r);
      if (r.applied) await mutate((key) => Array.isArray(key) && key.includes(id));
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Calibrate class thresholds"
        description="From this country's own record"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void run(false)} disabled={busy !== null}>
              {busy === "run" ? <Loader2 className="animate-spin" /> : <SlidersHorizontal />} Compute
            </Button>
            {res && !res.applied ? (
              <Button variant="accent" size="sm" onClick={() => void run(true)} disabled={busy !== null}>
                {busy === "apply" ? <Loader2 className="animate-spin" /> : <Check />} Apply
              </Button>
            ) : null}
          </div>
        }
      />
      <CardBody>
        {err ? <ErrorState error={err} className="mb-4 p-5" /> : null}
        <Table>
          <thead>
            <tr>
              <Th>Thresholds</Th>
              <Th className="text-right">In use</Th>
              <Th className="text-right">Calibrated</Th>
              <Th className="text-right">Fit</Th>
              <Th className="text-right">Points</Th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <Tr key={r.key}>
                <Td>{r.label}</Td>
                <Td className="text-right tabular">{fmt(current[r.key])}</Td>
                <Td className="text-right tabular">{res ? fmt(res.breaks[r.key]) : "n/a"}</Td>
                <Td className="text-right tabular">{res && r.gvf ? res.gvf[r.gvf].toFixed(3) : "n/a"}</Td>
                <Td className="text-right tabular">{res && r.gvf ? res.n[r.gvf] : "n/a"}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        {res?.warnings.length ? (
          <ul className="mt-3 space-y-1 text-[12.5px] text-muted">
            {res.warnings.map((w) => (
              <li key={w}>· {w}</li>
            ))}
          </ul>
        ) : null}
        {res?.applied ? <p className="mt-3 text-[12.5px] font-medium text-ink">Applied.</p> : null}
      </CardBody>
    </Card>
  );
}
