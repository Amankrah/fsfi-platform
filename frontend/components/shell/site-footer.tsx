"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHealth } from "@/lib/api";
import { SITE } from "@/lib/site";

/** Footer: contact, licence, version, partners, links. Text only. */
export function SiteFooter() {
  const { data: health } = useHealth();
  return (
    <footer data-site-footer className="mt-auto border-t border-rule bg-ivory">
      <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-4 py-10 t-ui text-ink-muted md:grid-cols-12 md:px-6">
        <div className="md:col-span-5">
          <p className="text-[1.125rem] font-semibold text-evergreen">{SITE.name}</p>
          <p className="mt-2">
            Developed by the International Food Policy Research Institute (IFPRI) and the Department of Bioresource
            Engineering, McGill University. All country data on this site are synthetic.
          </p>
        </div>
        <nav aria-label="Footer" className="md:col-span-4">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {[
              ["/method", "Method"],
              ["/assessments", "Assessments"],
              ["/countries", "Compare countries"],
              ["/score", "Score a draft budget"],
              ["/data", "Data and downloads"],
              ["/about", "About and citation"],
              ["/about#changelog", "Version history"],
              ["/about#licence", "Licence"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-green-700 hover:text-evergreen hover:underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="md:col-span-3">
          <p>
            Contact:{" "}
            <a className="text-green-700 underline" href={`mailto:${SITE.contact}`}>
              {SITE.contact}
            </a>
          </p>
          <p className="mt-1.5 tabular">
            Platform version {health?.version ?? "…"}
            {health ? <>, engine: {health.engine}</> : null}
          </p>
          <p className="mt-1.5">No cookies or analytics are used.</p>
        </div>
      </div>
    </footer>
  );
}

/** Repeated at the foot of every printed page: URL and access date. */
export function PrintFooter() {
  const pathname = usePathname();
  const [stamp, setStamp] = React.useState("");
  React.useEffect(() => {
    const id = requestAnimationFrame(() =>
      setStamp(
        `${window.location.href} · accessed ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
      ),
    );
    return () => cancelAnimationFrame(id);
  }, [pathname]);
  return (
    <div className="print-footer" aria-hidden>
      {SITE.name} · {stamp}
    </div>
  );
}
