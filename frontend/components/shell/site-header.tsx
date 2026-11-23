"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/method", label: "Method" },
  { href: "/assessments", label: "Assessments", also: ["/countries/"] },
  { href: "/countries", label: "Compare", exact: true },
  { href: "/score", label: "Score a draft" },
  { href: "/data", label: "Data" },
  { href: "/about", label: "About" },
] as const;

function isActive(pathname: string, item: (typeof NAV)[number]) {
  if ("exact" in item && item.exact) return pathname === item.href;
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return "also" in item ? item.also.some((p) => pathname.startsWith(p)) : false;
}

/** Public top navigation: wordmark, six destinations, one primary action. Opaque evergreen bar, no blur. */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <header data-site-header className="on-dark sticky top-0 z-40 bg-evergreen text-white">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-6 px-4 md:px-6">
        <Link href="/" className="shrink-0" aria-label="FSFSI home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden h-full items-stretch lg:flex">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center px-3 text-[14px] text-white/85 hover:text-white",
                  active && "text-white",
                )}
              >
                {item.label}
                {active ? <span aria-hidden className="absolute inset-x-3 bottom-0 h-[3px] bg-saffron-bright" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/assessments"
            className="hidden h-9 items-center rounded-[2px] bg-white px-4 text-[14px] font-medium text-evergreen hover:bg-ivory sm:inline-flex"
          >
            Open an assessment
          </Link>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[2px] text-white hover:bg-white/10 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>
      {open ? (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-white/20 px-4 pb-4 lg:hidden">
          <ul className="divide-y divide-white/15">
            {NAV.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn("flex h-11 items-center text-[15px] text-white/90", active && "font-semibold text-white")}
                  >
                    {active ? <span aria-hidden className="mr-2 h-4 w-[3px] bg-saffron-bright" /> : null}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            href="/assessments"
            className="mt-3 inline-flex h-10 items-center rounded-[2px] bg-white px-4 text-[14px] font-medium text-evergreen sm:hidden"
          >
            Open an assessment
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
