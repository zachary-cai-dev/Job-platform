"use client";

import { SORT_OPTIONS } from "@/lib/labels";
import { useFilterNavigation } from "@/lib/useFilterNavigation";

export function SortSelect() {
  const { state, update } = useFilterNavigation();

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      Sort
      <select
        value={state.sort}
        onChange={(e) => update({ sort: e.target.value })}
        className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
