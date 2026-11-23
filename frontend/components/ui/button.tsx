import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui Button, re-themed: 2 px radius, no shadow, evergreen primary, outline secondary, quiet text button.
 * Legacy variant names (accent, ghost, subtle) map onto the three variants in the brief.
 */
export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[2px] font-medium transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-evergreen text-white hover:bg-[#0b2f27]",
        accent: "bg-evergreen text-white hover:bg-[#0b2f27]",
        secondary: "border border-rule-strong bg-surface text-evergreen hover:bg-ivory",
        outline: "border border-rule-strong bg-surface text-evergreen hover:bg-ivory",
        quiet: "bg-transparent text-green-700 hover:bg-ink-4 hover:text-evergreen",
        ghost: "bg-transparent text-ink hover:bg-ink-6",
        subtle: "bg-ink-6 text-ink hover:bg-ink-10",
        inverse: "on-dark bg-white text-evergreen hover:bg-ivory",
        "inverse-outline": "on-dark border border-white/80 text-white hover:bg-white/10",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-[15px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
