"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAssessment } from "@/lib/api";
import { useCountryCtx } from "@/components/shell/country-context";
import { Kpi, KpiRow } from "@/components/kpi";
import { Figure } from "@/components/charts/figure";
import { ComponentStressBars, ReallocationBars } from "@/components/charts/component-bars";
import { DiagnosisPlane } from "@/components/charts/diagnosis-plane";
import { DataTable } from "@/components/data-table";
import { ErrorState, PageSkeleton } from "@/components/states";
import { StressBadge } from "@/components/ui/badge";
import { componentColumns, componentTableColumns, indicatorColumns } from "@/lib/columns";
import { fmtIndex, fmtPct } from "@/lib/format";

export default function OverviewPage() {
  const { id, profile, controls, year, componentName } = useCountryCtx();
  const router = useRouter();
  const { data: a, error, mutate, isLoading } = useAssessment(id, controls);

  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (isLoading || !a) return <PageSkeleton />;

  const s = a.system;
  const moved = a.components.reduce((acc, c) => acc + Math.max(0, c.shift_pp), 0) / 100;
  const unfundedComps = a.components.filter((c) => c.diagnosis === "unfunded_gap");
  const assessed = a.indicators.length;
  const measured = a.indicators.filter((i) => !i.imputed).length;
  const top = [...a.components].sort((x, y) => y.stress - x.stress)[0];
  const gain = [...a.components].sort((x, y) => y.shift_pp - x.shift_pp)[0];
  const loss = [...a.components].sort((x, y) => x.shift_pp - y.shift_pp)[0];

  return (
    <div className="space-y-8">
      <KpiRow>
        <Kpi
          label="Stress index"
          year={year}
          value={s.fsfsi}
          format={(v) => v.toFixed(2)}
          sub={<StressBadge cls={s.stress_class} />}
          hint="Weighted share of performance gaps left unfinanced; 0 is none."
        />
        <Kpi
          label="Envelope reallocated at optimum"
          year={year}
          value={moved * 100}
          format={(v) => v.toFixed(1)}
          unit="%"
          sub={<>Efficiency {fmtIndex(s.efficiency)}</>}
          hint="Share of the budget that moves between components to reach the lowest stress."
        />
        <Kpi
          label="Components with unfunded gaps"
          year={year}
          value={unfundedComps.length}
          format={(v) => v.toFixed(0)}
          unit={`of ${a.components.length}`}
          hint="Components whose gaps money has largely not reached."
        />
        <Kpi
          label="Data completeness"
          year={year}
          value={assessed ? (measured / assessed) * 100 : null}
          format={(v) => v.toFixed(0)}
          unit="%"
          sub={<>{measured} of {assessed} gaps measured, {assessed - measured} imputed</>}
          hint="Assessed indicators with an observed value rather than an imputed one."
        />
      </KpiRow>

      <section aria-labelledby="dx-h" className="space-y-4">
        <h2 id="dx-h" className="t-h2">
          Diagnosis
        </h2>
        <Figure
          title={`${top?.name ?? "One component"} carries the most financing stress, ${fmtIndex(top?.stress)}`}
          subtitle={`Component stress (0 = none, 1 = whole gap unfinanced), ranked, ${profile.name}, ${year}`}
          notes="Bar colour shows the diagnosis class, written beside each bar."
          data={{ columns: componentColumns, rows: a.components, filename: "component-stress", initialSort: { key: "stress", desc: true } }}
        >
          <ComponentStressBars rows={a.components} />
        </Figure>
      </section>

      <Figure
        title={`At the optimum, ${gain?.name ?? "one component"} gains ${fmtPct((gain?.shift_pp ?? 0) / 100, 1)} of the envelope and ${loss?.name ?? "another"} gives up ${fmtPct(Math.abs(loss?.shift_pp ?? 0) / 100, 1)}`}
        subtitle={`Change in budget share at the optimal allocation (percentage points), same envelope, ${year}`}
        data={{ columns: componentColumns, rows: a.components, filename: "reallocation", initialSort: { key: "shift", desc: true } }}
      >
        <ReallocationBars rows={a.components} />
      </Figure>

      <section aria-labelledby="comp-h">
        <h2 id="comp-h" className="t-h2">
          Components
        </h2>
        <DataTable
          className="mt-4"
          rows={a.components}
          columns={componentTableColumns}
          caption={`Component results, ${profile.name}, ${year}. Hover a column heading for its full name; Ind. shows indicators assessed (imputed).`}
          filename={`${id}-${year}-components`}
          initialSort={{ key: "stress", desc: true }}
          rowKey={(r) => r.id}
        />
      </section>

      <Figure
        title={`${a.diagnosis_summary.find((d) => d.diagnosis === "unfunded_gap")?.count ?? 0} indicators have unfunded gaps`}
        subtitle={`Each assessed indicator by performance gap (0–1) and coverage class, ${year}. Select a marker to open the indicator.`}
        notes="Position within a column carries no information; marker shape identifies the component; a centre dot marks an imputed gap."
        data={{ columns: indicatorColumns(componentName), rows: a.indicators, filename: "indicators", initialSort: { key: "gap", desc: true } }}
      >
        <DiagnosisPlane
          indicators={a.indicators}
          components={profile.components}
          breaks={a.meta.breaks}
          summary={a.diagnosis_summary}
          onSelect={(code) => router.push(`/countries/${id}/indicators${controls.query}${controls.query ? "&" : "?"}code=${code}`)}
        />
      </Figure>
    </div>
  );
}
