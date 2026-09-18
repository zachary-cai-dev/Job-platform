"use client";

import { cn } from "@/lib/cn";
import { POSTED_WITHIN_OPTIONS } from "@/lib/labels";
import { useFilterNavigation } from "@/lib/useFilterNavigation";

export function PostedWithinChips() {
  const { state, update } = useFilterNavigation();

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => update({ postedWithin: "" })}
        className={cn(
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
          state.postedWithin === ""
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
        )}
      >
        Any time
      </button>
      {POSTED_WITHIN_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => update({ postedWithin: option.value })}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            state.postedWithin === option.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
