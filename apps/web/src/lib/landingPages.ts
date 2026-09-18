import type { JobSearchFilters } from "@euro-jobs/search";

export interface LandingPageConfig {
  slug: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  filters: Pick<JobSearchFilters, "roleCategory" | "region" | "country">;
}

/**
 * SEO landing pages (brief §28) — one shared dynamic route (app/[slug]/page.tsx)
 * over this data, not individually hand-built pages. Extending the set of indexed
 * category/region/country pages is adding a row here.
 */
export const LANDING_PAGES: LandingPageConfig[] = [
  {
    slug: "remote-software-engineer-jobs",
    h1: "Remote Software Engineer Jobs (Europe)",
    metaTitle: "Remote Software Engineer Jobs for Europe — Euro Jobs",
    metaDescription: "Freshly posted remote Software Engineer jobs open to candidates based in Europe.",
    filters: { roleCategory: ["SOFTWARE_ENGINEER"] },
  },
  {
    slug: "remote-full-stack-jobs",
    h1: "Remote Full Stack Engineer Jobs (Europe)",
    metaTitle: "Remote Full Stack Jobs for Europe — Euro Jobs",
    metaDescription: "Freshly posted remote Full Stack Engineer jobs open to candidates based in Europe.",
    filters: { roleCategory: ["FULL_STACK_ENGINEER"] },
  },
  {
    slug: "remote-backend-jobs",
    h1: "Remote Backend Engineer Jobs (Europe)",
    metaTitle: "Remote Backend Jobs for Europe — Euro Jobs",
    metaDescription: "Freshly posted remote Backend Engineer jobs open to candidates based in Europe.",
    filters: { roleCategory: ["BACKEND_ENGINEER"] },
  },
  {
    slug: "remote-frontend-jobs",
    h1: "Remote Frontend Engineer Jobs (Europe)",
    metaTitle: "Remote Frontend Jobs for Europe — Euro Jobs",
    metaDescription: "Freshly posted remote Frontend Engineer jobs open to candidates based in Europe.",
    filters: { roleCategory: ["FRONTEND_ENGINEER"] },
  },
  {
    slug: "remote-ai-engineer-jobs",
    h1: "Remote AI & Machine Learning Engineer Jobs (Europe)",
    metaTitle: "Remote AI Engineer Jobs for Europe — Euro Jobs",
    metaDescription: "Freshly posted remote AI and Machine Learning Engineer jobs open to candidates based in Europe.",
    filters: { roleCategory: ["AI_ENGINEER", "ML_ENGINEER"] },
  },
  {
    slug: "remote-data-engineer-jobs",
    h1: "Remote Data Engineer Jobs (Europe)",
    metaTitle: "Remote Data Engineer Jobs for Europe — Euro Jobs",
    metaDescription: "Freshly posted remote Data Engineer jobs open to candidates based in Europe.",
    filters: { roleCategory: ["DATA_ENGINEER"] },
  },
  {
    slug: "remote-devops-jobs",
    h1: "Remote DevOps Engineer Jobs (Europe)",
    metaTitle: "Remote DevOps Jobs for Europe — Euro Jobs",
    metaDescription: "Freshly posted remote DevOps Engineer jobs open to candidates based in Europe.",
    filters: { roleCategory: ["DEVOPS_ENGINEER"] },
  },
  {
    slug: "remote-jobs-europe",
    h1: "Remote Tech Jobs — Europe",
    metaTitle: "Remote Tech Jobs for Europe — Euro Jobs",
    metaDescription: "Freshly posted remote technology jobs open to candidates based anywhere in Europe.",
    filters: { region: ["EUROPE"] },
  },
  {
    slug: "remote-jobs-eu",
    h1: "Remote Tech Jobs — European Union",
    metaTitle: "Remote Tech Jobs for the EU — Euro Jobs",
    metaDescription: "Freshly posted remote technology jobs open to candidates based in the European Union.",
    filters: { region: ["EU"] },
  },
  {
    slug: "remote-jobs-eea",
    h1: "Remote Tech Jobs — EEA",
    metaTitle: "Remote Tech Jobs for the EEA — Euro Jobs",
    metaDescription: "Freshly posted remote technology jobs open to candidates based in the European Economic Area.",
    filters: { region: ["EEA"] },
  },
  {
    slug: "remote-jobs-emea",
    h1: "Remote Tech Jobs — EMEA",
    metaTitle: "Remote Tech Jobs for EMEA — Euro Jobs",
    metaDescription: "Freshly posted remote technology jobs open to candidates based in EMEA.",
    filters: { region: ["EMEA"] },
  },
  {
    slug: "remote-jobs-uk",
    h1: "Remote Tech Jobs — United Kingdom",
    metaTitle: "Remote Tech Jobs for the UK — Euro Jobs",
    metaDescription: "Freshly posted remote technology jobs open to candidates based in the United Kingdom.",
    filters: { country: ["GB"] },
  },
  {
    slug: "remote-jobs-germany",
    h1: "Remote Tech Jobs — Germany",
    metaTitle: "Remote Tech Jobs for Germany — Euro Jobs",
    metaDescription: "Freshly posted remote technology jobs open to candidates based in Germany.",
    filters: { country: ["DE"] },
  },
];

const BY_SLUG = new Map(LANDING_PAGES.map((page) => [page.slug, page]));

export function getLandingPageConfig(slug: string): LandingPageConfig | undefined {
  return BY_SLUG.get(slug);
}
