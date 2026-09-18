"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { useFilterNavigation } from "@/lib/useFilterNavigation";

export function SearchInput() {
  const { state, update } = useFilterNavigation();
  const [value, setValue] = useState(state.q);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        update({ q: value });
      }}
      className="relative flex-1"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search title, company, or technology..."
        className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </form>
  );
}
