/* eslint-disable no-console -- CLI seed script; progress output is the intended UX */
import { OTHER_ROLE_CATEGORY, ROLE_CATEGORIES, TECHNOLOGIES } from "@euro-jobs/normalization";
import {
  PrismaClient,
  Prisma,
  type SourceKind,
  type IntegrationMethod,
  type SourceStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

interface SourceSeed {
  slug: string;
  displayName: string;
  kind: SourceKind;
  integrationMethod: IntegrationMethod;
  status: SourceStatus;
  config?: Prisma.InputJsonObject;
}

/**
 * MVP-candidate sources: architecture-ready. Greenhouse/Lever/Ashby/RemoteOK/
 * SmartRecruiters are `ENABLED` with a small, hand-verified set of real company
 * boards (each curl'd live and confirmed to return real job data before being added
 * here) — deliberately a handful, not a real target list; expanding this list is
 * the still-open "curate company targets" task from docs/implementation-plan.md's
 * open questions. Workable stays `DISABLED` pending an adapter (not yet built —
 * SmartRecruiters was picked as the 5th MVP source per that doc's own note that
 * the choice is a Phase 3 detail).
 *
 * Remotive/Himalayas/Working Nomads/Jobicy/No Fluff Jobs/Landing.jobs/We Work
 * Remotely/GermanTechJobs/Python.org Jobs/LaraJobs were added after a systematic
 * pass over ~100 candidate job platforms, keeping only ones with a genuinely
 * public, unauthenticated API/RSS feed — no scraping, no auth-bypass, no ToS
 * violation (docs/ingestion.md's source-integration priority order). Each was
 * personally curl-verified for its real response shape before an adapter was
 * written; `weworkremotely`/`himalayas`/`jobicy` were previously (incorrectly)
 * marked `UNSUPPORTED` below — that was a research gap, not a genuine ToS/legal
 * bar. See each adapter's own doc comments under packages/sources/src (one
 * directory per source) for per-source terms (e.g. Remotive's and Jobicy's
 * attribution/rate-limit requests).
 */
const CANDIDATE_SOURCES: SourceSeed[] = [
  {
    slug: "greenhouse",
    displayName: "Greenhouse",
    kind: "ATS",
    integrationMethod: "PUBLIC_API",
    status: "ENABLED",
    config: {
      companies: [
        { boardToken: "gitlab", companyName: "GitLab" },
        { boardToken: "discord", companyName: "Discord" },
      ],
    },
  },
  {
    slug: "lever",
    displayName: "Lever",
    kind: "ATS",
    integrationMethod: "PUBLIC_API",
    status: "ENABLED",
    config: {
      companies: [{ companySlug: "lever", companyName: "Lever" }],
    },
  },
  {
    slug: "ashby",
    displayName: "Ashby",
    kind: "ATS",
    integrationMethod: "PUBLIC_API",
    status: "ENABLED",
    config: {
      companies: [
        { organizationSlug: "linear", companyName: "Linear" },
        { organizationSlug: "vercel", companyName: "Vercel" },
      ],
    },
  },
  {
    slug: "remoteok",
    displayName: "RemoteOK",
    kind: "AGGREGATOR",
    integrationMethod: "PUBLIC_API",
    status: "ENABLED",
    config: {},
  },
  {
    slug: "workable",
    displayName: "Workable",
    kind: "ATS",
    integrationMethod: "PUBLIC_API",
    status: "ENABLED",
    config: {
      companies: [
        { subdomain: "climax-studios", companyName: "Climax Studios" },
        { subdomain: "methods", companyName: "Methods" },
        { subdomain: "joinblink", companyName: "Blink" },
      ],
      requestDelayMs: 500,
    },
  },
  {
    slug: "smartrecruiters",
    displayName: "SmartRecruiters",
    kind: "ATS",
    integrationMethod: "PUBLIC_API",
    status: "ENABLED",
    config: {
      companies: [{ companyIdentifier: "Cint", companyName: "Cint" }],
    },
  },
  {
    slug: "remotive",
    displayName: "Remotive",
    kind: "AGGREGATOR",
    integrationMethod: "PUBLIC_API",
    status: "ENABLED",
    // Remotive's own published terms ask for at most ~4 requests/day — 6h keeps us
    // comfortably under that (4x/day) while still catching same-day postings.
    config: { pollIntervalMs: 6 * 60 * 60 * 1000 },
  },
  {
    slug: "himalayas",
    displayName: "Himalayas",
    kind: "AGGREGATOR",
    integrationMethod: "PUBLIC_API",
    status: "ENABLED",
    // No server-side category filter on this feed (verified live) — most of its
    // 100k+ global catalog isn't tech, so the adapter itself caps how many
    // newest-first pages it walks per run (see HimalayasAdapterConfig.maxPages).
    // 15 pages at Himalayas' real (server-capped) 20-jobs/page yield ~300 jobs/run.
    config: { maxPages: 15, pollIntervalMs: 30 * 60 * 1000 },
  },
  {
    slug: "workingnomads",
    displayName: "Working Nomads",
    kind: "AGGREGATOR",
    integrationMethod: "PUBLIC_API",
    status: "ENABLED",
    config: {},
  },
  {
    slug: "jobicy",
    displayName: "Jobicy",
    kind: "AGGREGATOR",
    integrationMethod: "PUBLIC_API",
    status: "ENABLED",
    // Server-side geo/industry filters (verified live) keep the fetch on-topic.
    config: { geo: "europe", industry: "dev", count: 50 },
  },
  {
    slug: "nofluffjobs",
    displayName: "No Fluff Jobs",
    kind: "AGGREGATOR",
    integrationMethod: "PUBLIC_API",
    status: "ENABLED",
    // Single request returns the entire (IT-only) catalog — polled less
    // aggressively than the 15-minute default out of courtesy, not necessity.
    config: { pollIntervalMs: 2 * 60 * 60 * 1000 },
  },
  {
    slug: "landingjobs",
    displayName: "Landing.jobs",
    kind: "AGGREGATOR",
    integrationMethod: "PUBLIC_API",
    status: "ENABLED",
    config: {},
  },
  {
    slug: "weworkremotely",
    displayName: "We Work Remotely",
    kind: "AGGREGATOR",
    integrationMethod: "RSS_FEED",
    status: "ENABLED",
    config: {},
  },
  {
    slug: "germantechjobs",
    displayName: "GermanTechJobs",
    kind: "AGGREGATOR",
    integrationMethod: "RSS_FEED",
    status: "ENABLED",
    config: {},
  },
  {
    slug: "pythonjobs",
    displayName: "Python.org Jobs",
    kind: "AGGREGATOR",
    integrationMethod: "RSS_FEED",
    status: "ENABLED",
    config: {},
  },
  {
    slug: "larajobs",
    displayName: "LaraJobs",
    kind: "AGGREGATOR",
    integrationMethod: "RSS_FEED",
    status: "ENABLED",
    config: {},
  },
  {
    slug: "hackernews",
    displayName: "Hacker News (Who is Hiring?)",
    kind: "AGGREGATOR",
    integrationMethod: "OFFICIAL_API",
    status: "ENABLED",
    // Official, documented Firebase-backed API — Y Combinator's own product for
    // third-party consumption. Only the current month's thread is worth polling
    // repeatedly (new top-level comments trickle in for weeks); 30 min is plenty.
    config: { pollIntervalMs: 30 * 60 * 1000 },
  },
  {
    slug: "jobgether",
    displayName: "Jobgether",
    kind: "AGGREGATOR",
    integrationMethod: "OFFICIAL_API",
    status: "ENABLED",
    // /astroapi/ai/jobs/docs describes this explicitly as built for AI-agent
    // consumption, and it's explicitly allowlisted in robots.txt
    // (Allow: /astroapi/ai/jobs.json) — a real documented, versioned contract, not
    // a reverse-engineered endpoint. Server-side `locations` filter narrows the
    // fetch up front.
    config: { locations: ["europe"] },
  },
  {
    slug: "teamtailor",
    displayName: "Teamtailor",
    kind: "ATS",
    integrationMethod: "RSS_FEED",
    status: "ENABLED",
    config: {
      companies: [{ feedUrl: "https://career.teamtailor.com/jobs.rss", companyName: "Teamtailor" }],
      maxPages: 10,
      pageSize: 100,
      requestDelayMs: 500,
    },
  },
  {
    slug: "personio",
    displayName: "Personio",
    kind: "ATS",
    integrationMethod: "STRUCTURED_FEED",
    status: "ENABLED",
    config: {
      companies: [{ account: "personio", companyName: "Personio", companyUrl: "https://www.personio.com" }],
      language: "en",
      requestDelayMs: 500,
    },
  },
  {
    slug: "recruitee",
    displayName: "Recruitee",
    kind: "ATS",
    integrationMethod: "STRUCTURED_FEED",
    status: "ENABLED",
    config: {
      companies: [{ subdomain: "decoded", companyName: "Decoded" }],
      requestDelayMs: 500,
    },
  },
  {
    slug: "pinpoint",
    displayName: "Pinpoint",
    kind: "ATS",
    integrationMethod: "PUBLIC_API",
    status: "ENABLED",
    config: {
      companies: [{ subdomain: "workwithus", companyName: "Pinpoint", companyUrl: "https://www.pinpointhq.com" }],
      requestDelayMs: 500,
    },
  },
  {
    slug: "careerpage",
    displayName: "Company career pages (JSON-LD)",
    kind: "CAREERS_PAGE",
    integrationMethod: "STRUCTURED_FEED",
    status: "DISABLED",
    config: { companies: [], maxJobs: 100, requestDelayMs: 500 },
  },
  {
    slug: "linkedin",
    displayName: "LinkedIn",
    kind: "JOB_BOARD",
    integrationMethod: "PERMITTED_CRAWL",
    status: "ENABLED",
    // Anonymous public search/detail HTML only. The adapter stops on any auth wall,
    // CAPTCHA/challenge, 401/403, or 429 and deliberately runs sequentially.
    config: {
      keywords: [
        "Senior Software Engineer",
        "Senior Backend Engineer",
        "Senior Full Stack Engineer",
        "Senior Frontend Engineer",
        "Staff Software Engineer",
        "Frontend Engineer",
        "React Engineer",
        "Node.js Engineer",
        "Python Engineer",
        "AI Engineer",
      ],
      locations: ["United Kingdom", "London", "Remote", "Europe", "United States"],
      datePosted: "pastWeek",
      maxJobs: 250,
      maxPages: 10,
      requestDelayMs: 2000,
      parserVersion: 3,
      pollIntervalMs: 6 * 60 * 60 * 1000,
    },
  },
  {
    slug: "remoteyeah",
    displayName: "RemoteYeah",
    kind: "JOB_BOARD",
    integrationMethod: "PERMITTED_CRAWL",
    status: "ENABLED",
    // No API or feed, but robots.txt explicitly permits crawling (Disallow: empty,
    // sitemap published). Job URLs come from the category pages' own HTML; each
    // job's actual data comes from its schema.org JobPosting JSON-LD (built for
    // Google for Jobs indexing), not selector-based scraping of visible markup —
    // see packages/sources/src/remoteyeah/adapter.ts.
    config: {
      maxJobs: 300,
      requestDelayMs: 300,
      parserVersion: 2,
      pollIntervalMs: 6 * 60 * 60 * 1000,
    },
  },
  {
    slug: "wellfound",
    displayName: "Wellfound",
    kind: "JOB_BOARD",
    integrationMethod: "PERMITTED_CRAWL",
    status: "ENABLED",
    // Public server-rendered role pages + schema.org JobPosting JSON-LD. Wellfound's
    // robots.txt permits these paths; the adapter never visits disallowed /search,
    // /_jobs, authenticated, application, or profile routes.
    config: {
      listingUrls: [
        "https://wellfound.com/role/l/software-engineer/europe",
        "https://wellfound.com/role/l/backend-engineer/europe",
        "https://wellfound.com/role/l/full-stack-software-engineer/europe",
        "https://wellfound.com/role/l/software-engineer/united-kingdom",
        "https://wellfound.com/role/l/software-developer/united-kingdom",
        "https://wellfound.com/role/l/software-engineer/united-states",
        "https://wellfound.com/role/l/backend-engineer/united-states",
        "https://wellfound.com/role/l/full-stack-software-engineer/united-states",
      ],
      maxJobs: 150,
      maxPages: 5,
      requestDelayMs: 2000,
      parserVersion: 2,
      pollIntervalMs: 6 * 60 * 60 * 1000,
    },
  },
];

/** No current legitimate public integration path — documented, not attempted. */
const UNSUPPORTED_SOURCES: SourceSeed[] = [
  {
    slug: "jobright",
    displayName: "Jobright",
    kind: "JOB_BOARD",
    integrationMethod: "PERMITTED_CRAWL",
    status: "UNSUPPORTED",
    config: {
      note:
        "robots.txt explicitly disallows /api/ for everyone and specifically blocks ClaudeBot/GPTBot from /jobs/ — an explicit signal not to access this site programmatically, unlike Jobgether's opposite (explicitly allowlisted) stance.",
    },
  },
  {
    slug: "indeed",
    displayName: "Indeed",
    kind: "JOB_BOARD",
    integrationMethod: "PERMITTED_CRAWL",
    status: "UNSUPPORTED",
    config: {
      note: "Publisher API access is restricted and current robots.txt disallows the relevant UK job/search/detail paths; no permitted collector is configured.",
    },
  },
  {
    slug: "glassdoor",
    displayName: "Glassdoor",
    kind: "JOB_BOARD",
    integrationMethod: "PERMITTED_CRAWL",
    status: "UNSUPPORTED",
    config: {
      note: "No public jobs API; current robots.txt disallows /search and /jobview, so direct collection is not attempted.",
    },
  },
  {
    slug: "welcometothejungle",
    displayName: "Welcome to the Jungle",
    kind: "JOB_BOARD",
    integrationMethod: "PERMITTED_CRAWL",
    status: "UNSUPPORTED",
    config: {
      note: "Public SEO listing pages are permitted, but ordinary unauthenticated job-detail requests currently return 403; collection stops rather than bypassing that control.",
    },
  },
  {
    slug: "workday",
    displayName: "Workday",
    kind: "ATS",
    integrationMethod: "ATS_ENDPOINT",
    status: "UNSUPPORTED",
    config: {
      note: "Documented Recruiting APIs require tenant authentication; public landing HTML contains no postings without browser rendering, and no private endpoint is reverse engineered.",
    },
  },
  {
    slug: "bamboohr",
    displayName: "BambooHR",
    kind: "ATS",
    integrationMethod: "OFFICIAL_API",
    status: "UNSUPPORTED",
    config: {
      note: "The documented applicant-tracking API requires OAuth or an API key, and no employer tenant/credential has been configured.",
    },
  },
];

/**
 * Retries a single Prisma call a few times with backoff. The source list has grown
 * long enough (30+ sequential upserts) that Supabase's pooler occasionally closes
 * the connection partway through the loop (P1017/P1001) — same transient WAN-pooler
 * unreliability documented elsewhere in this codebase (e.g.
 * packages/jobs/src/prismaJobRepository.ts), not a bug in the upsert itself.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}

async function seedSources() {
  for (const source of [...CANDIDATE_SOURCES, ...UNSUPPORTED_SOURCES]) {
    await withRetry(() =>
      prisma.source.upsert({
        where: { slug: source.slug },
        create: source,
        update: {
          displayName: source.displayName,
          kind: source.kind,
          integrationMethod: source.integrationMethod,
          status: source.status,
          config: source.config,
        },
      }),
    );
  }
  console.log(`Seeded ${CANDIDATE_SOURCES.length + UNSUPPORTED_SOURCES.length} sources.`);
}

async function seedRoleCategories() {
  const rows = [
    ...ROLE_CATEGORIES.map((c) => ({ slug: c.slug, label: c.label })),
    { slug: OTHER_ROLE_CATEGORY.slug, label: "Other" },
  ];
  for (const row of rows) {
    await prisma.roleCategory.upsert({
      where: { slug: row.slug },
      create: row,
      update: { label: row.label },
    });
  }
  console.log(`Seeded ${rows.length} role categories.`);
}

async function seedTechnologies() {
  for (const tech of TECHNOLOGIES) {
    await prisma.technology.upsert({
      where: { slug: tech.slug },
      create: {
        slug: tech.slug,
        displayName: tech.displayName,
        aliases: tech.aliases,
        category: tech.category,
      },
      update: {
        displayName: tech.displayName,
        aliases: tech.aliases,
        category: tech.category,
      },
    });
  }
  console.log(`Seeded ${TECHNOLOGIES.length} technologies.`);
}

async function main() {
  await seedSources();
  await seedRoleCategories();
  await seedTechnologies();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
