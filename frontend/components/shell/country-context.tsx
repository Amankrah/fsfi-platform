"use client";

import * as React from "react";
import type { Controls, CountryProfile } from "@/lib/types";

export interface CountryCtx {
  id: string;
  profile: CountryProfile;
  controls: Controls & { set: (p: Partial<Controls>) => void; query: string };
  /** year resolved to the latest when not set in the URL */
  year: string;
  componentIds: string[];
  componentName: (id: string) => string;
}

const Ctx = React.createContext<CountryCtx | null>(null);

export function CountryProvider({ value, children }: { value: CountryCtx; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCountryCtx(): CountryCtx {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useCountryCtx must be used inside a country page");
  return v;
}
