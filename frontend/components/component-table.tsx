"use client";

import type { Component, ComponentResult } from "@/lib/types";
import { componentTableColumns } from "@/lib/columns";
import { DataTable } from "./data-table";

/** Component results as a sortable DataTable (used by the builder review step). */
export function ComponentTable({ rows }: { rows: ComponentResult[]; components?: Component[] }) {
  return (
    <DataTable
      rows={rows}
      columns={componentTableColumns}
      caption="Component results"
      captionHidden
      filename="draft-country-components"
      initialSort={{ key: "stress", desc: true }}
      rowKey={(r) => r.id}
    />
  );
}
