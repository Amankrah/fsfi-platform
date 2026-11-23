"use client";

import * as React from "react";
import { Check, Copy, Download } from "lucide-react";
import { useHealth } from "@/lib/api";
import { citationBibtex, citationRis, citationText } from "@/lib/site";
import { Button } from "./ui/button";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Recommended citation of the archived platform release, with copy, BibTeX and RIS. */
export function CitationBlock() {
  const { data: health } = useHealth();
  const text = citationText(health?.version);
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="max-w-[68ch]">
      <blockquote className="callout bg-surface py-3 pr-4 text-[1.0625rem] leading-7 text-ink">{text}</blockquote>
      <p className="mt-2 t-caption text-ink-subtle">
        Archived on Zenodo; the DOI resolves to the latest release. The accompanying article is in preparation and its
        citation will be added here on publication. Cite the platform version shown when you quote figures from it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" data-print-hide>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy citation"}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => download("fsfsi-citation.bib", citationBibtex(health?.version), "application/x-bibtex")}>
          <Download aria-hidden /> BibTeX
        </Button>
        <Button variant="secondary" size="sm" onClick={() => download("fsfsi-citation.ris", citationRis(health?.version), "application/x-research-info-systems")}>
          <Download aria-hidden /> RIS
        </Button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? "Citation copied to the clipboard" : ""}
      </span>
    </div>
  );
}
