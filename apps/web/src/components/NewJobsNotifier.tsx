"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchNewJobsCount } from "@/lib/apiClient";
import type { NewJobsCount } from "@/lib/types";
import { useFilterNavigation } from "@/lib/useFilterNavigation";

const POLL_INTERVAL_MS = 5 * 60 * 1000;

interface Toast {
  id: string;
  message: string;
}

function formatMessage(result: NewJobsCount): string {
  const breakdown = result.bySource.map((source) => `${source.displayName}: ${source.count}`).join(", ");
  return `${result.total} new job${result.total === 1 ? "" : "s"} posted (${breakdown})`;
}

/**
 * Polls for newly-discovered listings every 5 minutes — matching the worker's
 * default ingestion cadence (apps/worker/src/scheduler.ts) — and shows a toast
 * summarizing new listings by source when there are any. A toast stays up
 * indefinitely (no auto-dismiss timer) until the viewer clicks its close button.
 * The very first poll only counts listings discovered after this component
 * mounted, so a viewer never gets notified about jobs that were already there
 * when they loaded the page.
 */
export function NewJobsNotifier() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastCheckedRef = useRef<string>(new Date().toISOString());
  const { state } = useFilterNavigation();
  // A ref, not a dependency the effect restarts on — switching tabs shouldn't
  // reset the poll interval or lastCheckedRef, just change what the *next*
  // poll counts against.
  const tabRef = useRef(state.tab);
  tabRef.current = state.tab;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const result = await fetchNewJobsCount(lastCheckedRef.current, tabRef.current);
        if (cancelled) return;
        lastCheckedRef.current = result.checkedAt;
        if (result.total > 0) {
          const id = result.checkedAt;
          setToasts((prev) => [...prev, { id, message: formatMessage(result) }]);
        }
      } catch {
        // A failed poll just retries at the next interval — not worth surfacing.
      }
    }

    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-lg"
        >
          <span>{toast.message}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
