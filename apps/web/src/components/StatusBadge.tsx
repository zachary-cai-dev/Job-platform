import { cn } from "@/lib/cn";

const COLORS: Record<string, string> = {
  ENABLED: "bg-emerald-50 text-emerald-700",
  SUCCESS: "bg-emerald-50 text-emerald-700",
  RUNNING: "bg-blue-50 text-blue-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  DISABLED: "bg-muted text-muted-foreground",
  UNSUPPORTED: "bg-muted text-muted-foreground",
  FAILED: "bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        COLORS[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}
