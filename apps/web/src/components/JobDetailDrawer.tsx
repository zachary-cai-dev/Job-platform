"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, X } from "lucide-react";
import { useEffect } from "react";
import { ApplyButton } from "@/components/ApplyButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { fetchJobDetail } from "@/lib/apiClient";
import { formatSalary } from "@/lib/formatSalary";
import { EMPLOYMENT_TYPE_LABELS, SENIORITY_LABELS } from "@/lib/labels";
import { formatRelativeTime } from "@/lib/relativeTime";
import { sanitizeJobDescription } from "@/lib/sanitizeHtml";

function DrawerSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-24 animate-pulse rounded bg-muted" />
      <div className="h-4 w-full animate-pulse rounded bg-muted" />
      <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
    </div>
  );
}

/**
 * Opens over the job list (same slide-in-panel pattern as FilterDrawer) instead of
 * navigating away — the standalone /jobs/[id] page is untouched and stays the
 * canonical, crawlable, directly-linkable page; this is a client-side convenience
 * layer for browsing without losing the list's scroll position/filters.
 */
export function JobDetailDrawer({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const open = jobId !== null;

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const {
    data: job,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => fetchJobDetail(jobId!),
    enabled: open,
  });

  if (!open) return null;

  const salary = job ? formatSalary(job) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close job details"
        className="absolute inset-0 bg-foreground/20"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="text-sm font-semibold text-foreground">Job details</span>
          <div className="flex items-center gap-1">
            {job && (
              <a
                href={`/jobs/${job.id}`}
                title="Open as a full page"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && <DrawerSkeleton />}
          {isError && <p className="py-16 text-center text-sm text-muted-foreground">Couldn't load this job.</p>}

          {job && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground">{job.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{job.company.name}</p>
                </div>
                {job.isActive && <ApplyButton applyUrl={job.applyUrl} />}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <Badge variant="accent">{job.locationDisplay}</Badge>
                {job.seniority && <Badge variant="outline">{SENIORITY_LABELS[job.seniority] ?? job.seniority}</Badge>}
                {job.employmentType && (
                  <Badge variant="outline">{EMPLOYMENT_TYPE_LABELS[job.employmentType] ?? job.employmentType}</Badge>
                )}
                {salary && <Badge variant="outline">{salary}</Badge>}
              </div>

              {job.technologies.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {job.technologies.map((tech) => (
                    <Badge key={tech.slug} variant="neutral">
                      {tech.displayName}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                {job.postedAt && <span>Posted {formatRelativeTime(job.postedAt)}</span>}
                {job.sources[0] && (
                  <>
                    <span aria-hidden>·</span>
                    <span>via {job.sources[0].displayName}</span>
                  </>
                )}
              </div>

              {!job.isActive && (
                <div className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  This listing is no longer active.
                </div>
              )}

              <hr className="my-5 border-border" />

              <div
                className="prose prose-sm max-w-none text-foreground [&_a]:text-primary"
                dangerouslySetInnerHTML={{ __html: sanitizeJobDescription(job.description) }}
              />

              {job.isActive && (
                <div className="mt-6">
                  <ApplyButton applyUrl={job.applyUrl} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
