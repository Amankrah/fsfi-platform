"use client";

import * as React from "react";
import { FileUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileDrop({
  onFile,
  accept = ".csv,text/csv",
  busy,
  label = "Drop a CSV here or browse",
  hint,
  className,
}: {
  onFile: (f: File) => void;
  accept?: string;
  busy?: boolean;
  label?: string;
  hint?: React.ReactNode;
  className?: string;
}) {
  const [over, setOver] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
        over ? "border-saffron bg-saffron-12" : "border-line-strong bg-ink-4",
        className,
      )}
    >
      {busy ? <Loader2 className="size-6 animate-spin text-ink-55" /> : <FileUp className="size-6 text-ink-55" strokeWidth={1.5} />}
      <button type="button" onClick={() => input.current?.click()} className="text-sm font-medium text-ink underline-offset-4 hover:underline">
        {label}
      </button>
      {hint ? <div className="text-xs text-muted">{hint}</div> : null}
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
