import { cn } from "@/lib/utils";

/** Wordmark: serif "FSFSI" with the full name beside it on wide screens. Text only, no emblem. */
export function Logo({ className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-3", className)}>
      <span className="font-serif text-[1.375rem] font-semibold leading-none tracking-[0.01em]">FSFSI</span>
      <span className="hidden text-[13px] leading-none text-white/85 xl:inline">Food System Financing Stress Index</span>
    </span>
  );
}
