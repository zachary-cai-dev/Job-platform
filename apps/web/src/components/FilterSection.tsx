"use client";

import { Checkbox } from "@/components/ui/Checkbox";

interface Option {
  value: string;
  label: string;
  count: number;
}

export function FilterSection({
  title,
  options,
  selected,
  onToggle,
  maxVisible = 8,
}: {
  title: string;
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  maxVisible?: number;
}) {
  if (options.length === 0) return null;

  return (
    <details className="border-b border-border py-3 first:pt-0" open={selected.length > 0}>
      <summary className="flex cursor-pointer select-none items-center justify-between text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {title}
        {selected.length > 0 && <span className="text-xs font-semibold text-primary">{selected.length}</span>}
      </summary>
      <div className="mt-2.5 max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {options.slice(0, maxVisible).map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Checkbox checked={selected.includes(option.value)} onChange={() => onToggle(option.value)} />
            <span className="flex-1 truncate">{option.label}</span>
            <span className="tabular-nums text-xs">{option.count}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
