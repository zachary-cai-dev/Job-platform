import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const badgeVariants = cva("inline-flex items-center rounded-md text-xs font-medium px-2 py-0.5", {
  variants: {
    variant: {
      neutral: "bg-muted text-muted-foreground",
      accent: "bg-accent text-accent-foreground",
      outline: "border border-border text-foreground",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
