"use client";

import * as React from "react";
import { SWRConfig } from "swr";
import { TooltipProvider } from "./ui/misc";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <TooltipProvider>{children}</TooltipProvider>
    </SWRConfig>
  );
}
