"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatSalary } from "@/lib/formatSalary";
import { formatRelativeTime } from "@/lib/relativeTime";
import type { JobListItem } from "@/lib/types";

const SENIORITY_LABEL: Record<string, string> = {
  INTERNSHIP: "Intern",
  JUNIOR: "Junior",
  MID: "Mid-Level",
  SENIOR: "Senior",
  STAFF: "Staff",
  PRINCIPAL: "Principal",
  LEAD: "Lead",
  MANAGER: "Manager",
  DIRECTOR: "Director",
};

function companyInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/**
 * Clicking the title opens the job detail drawer via `onOpen` (see
 * JobDetailDrawer/JobsFeed). `onOpen` is optional: the SEO landing pages
 * (app/[slug]/page.tsx) render this without any client-side interactivity by
 * design, so without it the title falls back to a plain, crawlable `<Link>` to the
 * standalone job page instead of a JS-only click handler.
 */
export function JobCard({ job, onOpen }: { job: JobListItem; onOpen?: (id: string) => void }) {
  const salary = formatSalary(job);

  const titleContent = (
    <h3 className="truncate text-[15px] font-semibold text-foreground group-hover:text-primary">{job.title}</h3>
  );
  const companyContent = <p className="mt-0.5 truncate text-sm text-muted-foreground">{job.companyName}</p>;

  return (
    <article className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 sm:p-5">
      <div className="flex gap-4">
        <div
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground"
        >
          {companyInitial(job.companyName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            {onOpen ? (
              <button type="button" onClick={() => onOpen(job.id)} className="min-w-0 text-left">
                {titleContent}
              </button>
            ) : (
              <Link href={`/jobs/${job.id}`} className="min-w-0">
                {titleContent}
              </Link>
            )}
            <div className="flex shrink-0 items-center gap-2">
              {salary && <span className="text-sm font-medium text-foreground">{salary}</span>}
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
              >
                Apply
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {onOpen ? (
            <button type="button" onClick={() => onOpen(job.id)} className="block text-left">
              {companyContent}
            </button>
          ) : (
            companyContent
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="accent">{job.locationDisplay}</Badge>
            {job.seniority && <Badge variant="outline">{SENIORITY_LABEL[job.seniority] ?? job.seniority}</Badge>}
            {job.technologies.slice(0, 5).map((tech) => (
              <Badge key={tech.slug} variant="neutral">
                {tech.displayName}
              </Badge>
            ))}
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span title={job.postedAtIsInferred ? "Posting date inferred — source didn't provide one" : undefined}>
              {formatRelativeTime(job.postedAt)}
            </span>
            {job.source && (
              <>
                <span aria-hidden>·</span>
                <span>{job.source.displayName}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
