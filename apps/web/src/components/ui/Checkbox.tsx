import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-2 focus:ring-primary/40",
        className,
      )}
      {...props}
    />
  );
}
