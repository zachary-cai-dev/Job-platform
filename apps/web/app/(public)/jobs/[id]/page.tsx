import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplyButton } from "@/components/ApplyButton";
import { Badge } from "@/components/ui/Badge";
import { formatSalary } from "@/lib/formatSalary";
import { getJobDetail, type JobDetail } from "@/lib/jobDetail";
import { formatRelativeTime } from "@/lib/relativeTime";
import { sanitizeJobDescription } from "@/lib/sanitizeHtml";
import { EMPLOYMENT_TYPE_LABELS, SENIORITY_LABELS } from "@/lib/labels";

interface JobPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: JobPageProps): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobDetail(id);
  if (!job) return { title: "Job not found — Euro Jobs" };

  const title = `${job.title} at ${job.company.name} — Euro Jobs`;
  const description = `${job.normalizedTitle} at ${job.company.name}. ${job.locationDisplay}. Apply for this remote tech role eligible for candidates in Europe.`;

  return {
    title,
    description,
    alternates: { canonical: `/jobs/${job.id}` },
    robots: job.isActive ? undefined : { index: false, follow: false },
  };
}

function buildJobPostingJsonLd(job: JobDetail) {
  const salary =
    job.salaryMin != null && job.salaryCurrency
      ? {
          "@type": "MonetaryAmount",
          currency: job.salaryCurrency,
          value: {
            "@type": "QuantitativeValue",
            minValue: job.salaryMin,
            maxValue: job.salaryMax ?? job.salaryMin,
            unitText: job.salaryPeriod === "HOURLY" ? "HOUR" : job.salaryPeriod === "DAILY" ? "DAY" : job.salaryPeriod === "MONTHLY" ? "MONTH" : "YEAR",
          },
        }
      : undefined;

  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.postedAt ?? undefined,
    employmentType: job.employmentType ?? undefined,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      sameAs: job.company.websiteUrl ?? undefined,
      logo: job.company.logoUrl ?? undefined,
    },
    jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: job.eligibleCountries.map((code) => ({
      "@type": "Country",
      name: code,
    })),
    baseSalary: salary,
    directApply: true,
    url: job.applyUrl,
  };
}

export default async function JobDetailPage({ params }: JobPageProps) {
  const { id } = await params;
  const job = await getJobDetail(id);
  if (!job) notFound();

  const salary = formatSalary(job);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all jobs
      </Link>

      {job.isActive && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJobPostingJsonLd(job)) }}
        />
      )}

      {!job.isActive && (
        <div className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          This listing is no longer active.
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{job.title}</h1>
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

        {job.eligibleCountries.length > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Eligible countries: {job.eligibleCountries.join(", ")}
            {job.geographyConfidence === "MEDIUM" && " (inferred from timezone/context)"}
          </p>
        )}

        <hr className="my-6 border-border" />

        <div
          className="prose prose-sm max-w-none text-foreground [&_a]:text-primary"
          dangerouslySetInnerHTML={{ __html: sanitizeJobDescription(job.description) }}
        />

        {job.isActive && (
          <div className="mt-6">
            <ApplyButton applyUrl={job.applyUrl} />
          </div>
        )}
      </div>
    </main>
  );
}
