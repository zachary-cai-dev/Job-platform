import type { RoleCategoryDefinition } from "../types.js";

/**
 * Ordered by priority — first category with a keyword hit wins as the primary
 * `roleCategory`. Order matters for compound titles: a discipline word ("full
 * stack", "backend") outranks a domain-context word ("AI Platform") so that e.g.
 * "Sr. Fullstack Software Developer - AI Platform" resolves to FULL_STACK_ENGINEER
 * with "ai" captured as a secondary tag, not as the primary category (see
 * docs/ingestion.md §5.1 and packages/normalization/src/domainTags.ts).
 *
 * Adding a new category is appending a row here — no code changes elsewhere.
 */
export const ROLE_CATEGORIES: RoleCategoryDefinition[] = [
  {
    slug: "FULL_STACK_ENGINEER",
    label: "Full Stack Software Engineer",
    baseTags: ["full-stack", "software-engineering"],
    keywords: ["full stack", "full-stack", "fullstack"],
  },
  {
    slug: "FRONTEND_ENGINEER",
    label: "Frontend Engineer",
    baseTags: ["frontend", "software-engineering"],
    keywords: ["frontend", "front-end", "front end"],
  },
  {
    slug: "BACKEND_ENGINEER",
    label: "Backend Engineer",
    baseTags: ["backend", "software-engineering"],
    keywords: ["backend", "back-end", "back end"],
  },
  {
    slug: "IOS_ENGINEER",
    label: "iOS Engineer",
    baseTags: ["ios", "mobile"],
    keywords: ["ios engineer", "ios developer", "ios"],
  },
  {
    slug: "ANDROID_ENGINEER",
    label: "Android Engineer",
    baseTags: ["android", "mobile"],
    keywords: ["android engineer", "android developer", "android"],
  },
  {
    slug: "MOBILE_ENGINEER",
    label: "Mobile Engineer",
    baseTags: ["mobile"],
    keywords: ["mobile engineer", "mobile developer"],
  },
  {
    slug: "QA_ENGINEER",
    label: "QA Engineer",
    baseTags: ["qa", "testing"],
    keywords: [
      "qa engineer",
      "quality assurance",
      "test automation",
      "automation engineer",
      "sdet",
    ],
  },
  {
    slug: "SECURITY_ENGINEER",
    label: "Security Engineer",
    baseTags: ["security"],
    keywords: ["security engineer", "application security engineer", "security engineering"],
  },
  {
    slug: "SITE_RELIABILITY_ENGINEER",
    label: "Site Reliability Engineer",
    baseTags: ["sre", "reliability"],
    keywords: ["site reliability", "sre engineer", "sre"],
  },
  {
    slug: "DEVOPS_ENGINEER",
    label: "DevOps Engineer",
    baseTags: ["devops"],
    keywords: ["devops"],
  },
  {
    slug: "PLATFORM_ENGINEER",
    label: "Platform Engineer",
    baseTags: ["platform"],
    keywords: ["platform engineer"],
  },
  {
    slug: "CLOUD_ENGINEER",
    label: "Cloud Engineer",
    baseTags: ["cloud"],
    keywords: ["cloud engineer"],
  },
  {
    slug: "DATA_ENGINEER",
    label: "Data Engineer",
    baseTags: ["data-engineering"],
    keywords: ["data engineer"],
  },
  {
    slug: "ANALYTICS_ENGINEER",
    label: "Analytics Engineer",
    baseTags: ["analytics"],
    keywords: ["analytics engineer"],
  },
  {
    slug: "DATA_SCIENTIST",
    label: "Data Scientist",
    baseTags: ["data-science"],
    keywords: ["data scientist"],
  },
  {
    slug: "ML_ENGINEER",
    label: "Machine Learning Engineer",
    baseTags: ["machine-learning", "ai"],
    keywords: ["machine learning engineer", "ml engineer"],
  },
  {
    slug: "AI_ENGINEER",
    label: "AI Engineer",
    baseTags: ["ai"],
    keywords: [
      "ai engineer",
      "generative ai engineer",
      "applied ai engineer",
      "ai/ml engineer",
    ],
  },
  {
    slug: "SOLUTIONS_ARCHITECT",
    label: "Solutions Architect",
    baseTags: ["architecture"],
    keywords: ["solutions architect", "technical architect"],
  },
  {
    slug: "SOFTWARE_ARCHITECT",
    label: "Software Architect",
    baseTags: ["architecture"],
    keywords: ["software architect"],
  },
  {
    slug: "ENGINEERING_MANAGEMENT",
    label: "Engineering Manager",
    baseTags: ["management"],
    keywords: ["engineering manager", "head of engineering", "director of engineering"],
  },
  {
    slug: "SOFTWARE_ENGINEER",
    label: "Software Engineer",
    baseTags: ["software-engineering"],
    keywords: ["software engineer", "software developer", "developer", "engineer"],
  },
];

export const OTHER_ROLE_CATEGORY: RoleCategoryDefinition = {
  slug: "OTHER",
  label: "",
  baseTags: [],
  keywords: [],
};
