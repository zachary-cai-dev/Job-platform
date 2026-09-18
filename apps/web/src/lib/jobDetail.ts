import { getPrisma } from "./db.js";

export interface JobDetail {
  id: string;
  title: string;
  normalizedTitle: string;
  roleCategorySlug: string;
  seniority: string | null;
  tags: string[];
  company: { name: string; slug: string; logoUrl: string | null; websiteUrl: string | null };
  description: string;
  locationRaw: string | null;
  locationDisplay: string;
  remoteType: string;
  eligibleCountries: string[];
  eligibleRegions: string[];
  geographyConfidence: string;
  geographyReason: string;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  technologies: Array<{ slug: string; displayName: string }>;
  postedAt: Date | null;
  postedAtIsInferred: boolean;
  applyUrl: string;
  isActive: boolean;
  sources: Array<{ slug: string; displayName: string; sourceUrl: string }>;
}

/** Full detail for a single job page (brief §27) — richer than the list DTO. */
export async function getJobDetail(id: string): Promise<JobDetail | null> {
  const prisma = getPrisma();
  const job = await prisma.job.findFirst({
    where: { id },
    include: {
      company: true,
      technologies: { include: { technology: { select: { displayName: true } } } },
      sourceListings: {
        where: { isActive: true },
        include: { source: { select: { displayName: true } } },
        orderBy: { firstDiscoveredAt: "asc" },
      },
    },
  });
  if (!job) return null;

  return {
    id: job.id,
    title: job.title,
    normalizedTitle: job.normalizedTitle,
    roleCategorySlug: job.roleCategorySlug,
    seniority: job.seniority,
    tags: job.tags,
    company: {
      name: job.company.name,
      slug: job.company.slug,
      logoUrl: job.company.logoUrl,
      websiteUrl: job.company.websiteUrl,
    },
    description: job.description,
    locationRaw: job.locationRaw,
    locationDisplay: job.locationDisplay,
    remoteType: job.remoteType,
    eligibleCountries: job.eligibleCountries,
    eligibleRegions: job.eligibleRegions,
    geographyConfidence: job.geographyConfidence,
    geographyReason: job.geographyReason,
    employmentType: job.employmentType,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency,
    salaryPeriod: job.salaryPeriod,
    technologies: job.technologies.map((t) => ({
      slug: t.technologySlug,
      displayName: t.technology.displayName,
    })),
    postedAt: job.postedAt,
    postedAtIsInferred: job.postedAtIsInferred,
    applyUrl: job.applyUrl,
    isActive: job.isActive,
    sources: job.sourceListings.map((listing) => ({
      slug: listing.sourceSlug,
      displayName: listing.source.displayName,
      sourceUrl: listing.sourceUrl,
    })),
  };
}
