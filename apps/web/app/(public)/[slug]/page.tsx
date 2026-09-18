import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobCard } from "@/components/JobCard";
import { getSearchService } from "@/lib/db";
import { getLandingPageConfig, LANDING_PAGES } from "@/lib/landingPages";
import { toJobListItem } from "@/lib/serialize";

interface LandingPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

/**
 * Lists every known landing slug; anything else 404s. No longer build-time
 * pre-rendered — the (public) layout's auth check forces dynamic rendering on
 * every request anyway.
 */
export function generateStaticParams() {
  return LANDING_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: LandingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const config = getLandingPageConfig(slug);
  if (!config) return {};
  return {
    title: config.metaTitle,
    description: config.metaDescription,
    alternates: { canonical: `/${config.slug}` },
  };
}

/**
 * SEO landing page (brief §28) — one shared route over `LANDING_PAGES`' data, fully
 * server-rendered (no client-side filter interactivity; that's the homepage's job).
 * Deliberately simple/static: crawlability matters more here than interactivity.
 */
export default async function LandingPage({ params, searchParams }: LandingPageProps) {
  const { slug } = await params;
  const config = getLandingPageConfig(slug);
  if (!config) notFound();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? "1") || 1);

  const result = await getSearchService().search({
    filters: config.filters,
    sort: "newest",
    page,
    pageSize: 20,
  });
  const items = result.items.map(toJobListItem);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-foreground">{config.h1}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {result.total.toLocaleString()} open position{result.total === 1 ? "" : "s"}, newest first
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No matching jobs right now — check back soon.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {result.totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-4 text-sm">
          {page > 1 && (
            <Link href={`/${slug}?page=${page - 1}`} className="text-primary hover:underline">
              ← Previous
            </Link>
          )}
          <span className="text-muted-foreground">
            Page {page} of {result.totalPages}
          </span>
          {page < result.totalPages && (
            <Link href={`/${slug}?page=${page + 1}`} className="text-primary hover:underline">
              Next →
            </Link>
          )}
        </div>
      )}

      <p className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
        <Link href="/" className="text-primary hover:underline">
          Search and filter all remote tech jobs for Europe →
        </Link>
      </p>
    </main>
  );
}
