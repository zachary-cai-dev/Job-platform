import {
  createAshbyAdapter,
  createCareerPageAdapter,
  createGermanTechJobsAdapter,
  createGreenhouseAdapter,
  createHackerNewsAdapter,
  createHimalayasAdapter,
  createJobgetherAdapter,
  createJobicyAdapter,
  createLandingJobsAdapter,
  createLaraJobsAdapter,
  createLeverAdapter,
  createLinkedInAdapter,
  createNoFluffJobsAdapter,
  createPythonJobsAdapter,
  createPersonioAdapter,
  createPinpointAdapter,
  createRecruiteeAdapter,
  createRemoteOkAdapter,
  createRemoteYeahAdapter,
  createRemotiveAdapter,
  createSmartRecruitersAdapter,
  createTeamtailorAdapter,
  createWorkableAdapter,
  createWeWorkRemotelyAdapter,
  createWellfoundAdapter,
  createWorkingNomadsAdapter,
  type JobSourceAdapter,
} from "@euro-jobs/sources";
import type { Logger } from "@euro-jobs/shared";
import { z } from "zod";

const greenhouseConfigSchema = z.object({
  companies: z.array(z.object({ boardToken: z.string().min(1), companyName: z.string().min(1) })),
});

const leverConfigSchema = z.object({
  companies: z.array(z.object({ companySlug: z.string().min(1), companyName: z.string().min(1) })),
});

const ashbyConfigSchema = z.object({
  companies: z.array(z.object({ organizationSlug: z.string().min(1), companyName: z.string().min(1) })),
});

const smartRecruitersConfigSchema = z.object({
  companies: z.array(z.object({ companyIdentifier: z.string().min(1), companyName: z.string().min(1) })),
});

const remotiveConfigSchema = z.object({ category: z.string().min(1).optional() });

const himalayasConfigSchema = z.object({
  maxPages: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
});

const jobicyConfigSchema = z.object({
  geo: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  count: z.number().int().positive().optional(),
});

const weWorkRemotelyConfigSchema = z.object({
  categorySlugs: z.array(z.string().min(1)).optional(),
});

const hackerNewsConfigSchema = z.object({ concurrency: z.number().int().positive().optional() });

const jobgetherConfigSchema = z.object({
  locations: z.array(z.string().min(1)).optional(),
  maxPages: z.number().int().positive().optional(),
});

const linkedinConfigSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1),
  locations: z.array(z.string().min(1)).min(1),
  workplaceTypes: z.array(z.enum(["remote", "hybrid", "on-site"])).optional(),
  datePosted: z.enum(["any", "past24Hours", "pastWeek", "pastMonth"]).optional(),
  maxJobs: z.number().int().positive().optional(),
  maxPages: z.number().int().positive().optional(),
  requestDelayMs: z.number().int().nonnegative().optional(),
  parserVersion: z.number().int().positive().optional(),
});

const companyBase = { companyName: z.string().min(1), companyUrl: z.string().url().optional() };
const requestSettings = { requestDelayMs: z.number().int().nonnegative().optional() };

const workableConfigSchema = z.object({
  companies: z.array(z.object({ ...companyBase, subdomain: z.string().min(1) })).min(1),
  ...requestSettings,
});
const teamtailorConfigSchema = z.object({
  companies: z.array(z.object({ ...companyBase, feedUrl: z.string().url() })).min(1),
  maxPages: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(),
  ...requestSettings,
});
const personioConfigSchema = z.object({
  companies: z.array(z.object({
    ...companyBase, account: z.string().min(1), host: z.enum(["jobs.personio.com", "jobs.personio.de"]).optional(),
  })).min(1),
  language: z.string().min(2).optional(), ...requestSettings,
});
const pinpointConfigSchema = z.object({
  companies: z.array(z.object({ ...companyBase, subdomain: z.string().min(1) })).min(1), ...requestSettings,
});
const recruiteeConfigSchema = z.object({
  companies: z.array(z.object({ ...companyBase, subdomain: z.string().min(1) })).min(1), ...requestSettings,
});
const careerPageConfigSchema = z.object({
  companies: z.array(z.object({
    ...companyBase, urls: z.array(z.string().url()).optional(), sitemapUrl: z.string().url().optional(),
    jobUrlPattern: z.string().min(1).optional(),
  })),
  maxJobs: z.number().int().positive().optional(), maxSitemapPages: z.number().int().positive().optional(),
  ...requestSettings,
});

const remoteYeahConfigSchema = z.object({
  categorySlugs: z.array(z.string().min(1)).optional(),
  maxJobs: z.number().int().positive().optional(),
  parserVersion: z.number().int().positive().optional(),
  ...requestSettings,
});

const wellfoundConfigSchema = z.object({
  listingUrls: z.array(z.string().url()).min(1).optional(),
  maxJobs: z.number().int().positive().optional(),
  maxPages: z.number().int().positive().optional(),
  parserVersion: z.number().int().positive().optional(),
  ...requestSettings,
});

/**
 * Maps a `Source.slug` + its DB-stored `config` JSON to a runnable adapter. Adding a
 * new *implemented* source means adding one case here (plus the adapter package
 * itself) — this is the one place in `apps/worker` that knows every source's name,
 * matching the "isolated adapters" architecture (docs/ingestion.md §2). A source
 * with no case here (including every `UNSUPPORTED` one) is skipped, not crashed on.
 */
export function buildAdapter(sourceSlug: string, config: unknown, logger?: Logger): JobSourceAdapter | null {
  switch (sourceSlug) {
    case "greenhouse": {
      const parsed = greenhouseConfigSchema.safeParse(config);
      if (!parsed.success || parsed.data.companies.length === 0) return null;
      return createGreenhouseAdapter(parsed.data);
    }
    case "lever": {
      const parsed = leverConfigSchema.safeParse(config);
      if (!parsed.success || parsed.data.companies.length === 0) return null;
      return createLeverAdapter(parsed.data);
    }
    case "ashby": {
      const parsed = ashbyConfigSchema.safeParse(config);
      if (!parsed.success || parsed.data.companies.length === 0) return null;
      return createAshbyAdapter(parsed.data);
    }
    case "remoteok":
      return createRemoteOkAdapter();
    case "smartrecruiters": {
      const parsed = smartRecruitersConfigSchema.safeParse(config);
      if (!parsed.success || parsed.data.companies.length === 0) return null;
      return createSmartRecruitersAdapter(parsed.data);
    }
    case "remotive": {
      const parsed = remotiveConfigSchema.safeParse(config ?? {});
      return createRemotiveAdapter(parsed.success ? parsed.data : {});
    }
    case "himalayas": {
      const parsed = himalayasConfigSchema.safeParse(config ?? {});
      return createHimalayasAdapter(parsed.success ? parsed.data : {});
    }
    case "workingnomads":
      return createWorkingNomadsAdapter();
    case "jobicy": {
      const parsed = jobicyConfigSchema.safeParse(config ?? {});
      return createJobicyAdapter(parsed.success ? parsed.data : {});
    }
    case "nofluffjobs":
      return createNoFluffJobsAdapter();
    case "landingjobs":
      return createLandingJobsAdapter();
    case "weworkremotely": {
      const parsed = weWorkRemotelyConfigSchema.safeParse(config ?? {});
      return createWeWorkRemotelyAdapter(parsed.success ? parsed.data : {});
    }
    case "germantechjobs":
      return createGermanTechJobsAdapter();
    case "pythonjobs":
      return createPythonJobsAdapter();
    case "larajobs":
      return createLaraJobsAdapter();
    case "hackernews": {
      const parsed = hackerNewsConfigSchema.safeParse(config ?? {});
      return createHackerNewsAdapter(parsed.success ? parsed.data : {});
    }
    case "jobgether": {
      const parsed = jobgetherConfigSchema.safeParse(config ?? {});
      return createJobgetherAdapter(parsed.success ? parsed.data : {});
    }
    case "linkedin": {
      const parsed = linkedinConfigSchema.safeParse(config);
      if (!parsed.success) return null;
      return createLinkedInAdapter({ ...parsed.data, logger });
    }
    case "workable": {
      const parsed = workableConfigSchema.safeParse(config);
      return parsed.success ? createWorkableAdapter(parsed.data) : null;
    }
    case "teamtailor": {
      const parsed = teamtailorConfigSchema.safeParse(config);
      return parsed.success ? createTeamtailorAdapter(parsed.data) : null;
    }
    case "personio": {
      const parsed = personioConfigSchema.safeParse(config);
      return parsed.success ? createPersonioAdapter(parsed.data) : null;
    }
    case "pinpoint": {
      const parsed = pinpointConfigSchema.safeParse(config);
      return parsed.success ? createPinpointAdapter(parsed.data) : null;
    }
    case "recruitee": {
      const parsed = recruiteeConfigSchema.safeParse(config);
      return parsed.success ? createRecruiteeAdapter(parsed.data) : null;
    }
    case "careerpage": {
      const parsed = careerPageConfigSchema.safeParse(config);
      return parsed.success ? createCareerPageAdapter(parsed.data) : null;
    }
    case "remoteyeah": {
      const parsed = remoteYeahConfigSchema.safeParse(config ?? {});
      return createRemoteYeahAdapter(parsed.success ? parsed.data : {});
    }
    case "wellfound": {
      const parsed = wellfoundConfigSchema.safeParse(config ?? {});
      return createWellfoundAdapter(parsed.success ? parsed.data : {});
    }
    default:
      return null;
  }
}
