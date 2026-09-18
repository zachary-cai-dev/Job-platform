import { load, type CheerioAPI } from "cheerio";
import { LINKEDIN_SELECTORS } from "./selectors.js";
import type {
  LinkedInJobDetail,
  LinkedInSalary,
  LinkedInSearchResult,
  LinkedInWorkplaceType,
} from "./types.js";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function firstText($: CheerioAPI, root: ReturnType<CheerioAPI>, selectors: readonly string[]): string | undefined {
  for (const selector of selectors) {
    const value = text(root.find(selector).first().text());
    if (value) return value;
  }
  return undefined;
}

function firstAttribute(
  root: ReturnType<CheerioAPI>,
  selectors: readonly string[],
  attribute: string,
): string | undefined {
  for (const selector of selectors) {
    const value = text(root.find(selector).first().attr(attribute));
    if (value) return value;
  }
  return undefined;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseRelativeDate(value: string | undefined, now: Date): Date | undefined {
  if (!value) return undefined;
  const absolute = parseDate(value);
  if (absolute) return absolute;
  const match = /(?:posted\s+)?(\d+)\s+(minute|hour|day|week|month)s?\s+ago/i.exec(value);
  if (!match?.[1] || !match[2]) return undefined;
  const amount = Number(match[1]);
  const milliseconds: Record<string, number> = {
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
  };
  return new Date(now.getTime() - amount * milliseconds[match[2].toLowerCase()]!);
}

function classifyWorkplace(...values: Array<string | undefined>): LinkedInWorkplaceType | undefined {
  const combined = values.filter(Boolean).join(" ").toLowerCase();
  if (/\bhybrid\b/.test(combined)) return "hybrid";
  if (/\bremote\b|telecommute/.test(combined)) return "remote";
  if (/\bon[ -]?site\b|\boffice-based\b/.test(combined)) return "on-site";
  return undefined;
}

export function extractLinkedInJobId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const decoded = value.replaceAll("&amp;", "&");
  const patterns = [
    /urn:li:jobPosting:(\d+)/i,
    /\/jobs\/view\/(?:[^/?#]*-)?(\d+)(?:[/?#]|$)/i,
    /[?&](?:currentJobId|jobId)=(\d+)(?:[&#]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(decoded);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

export function canonicalLinkedInJobUrl(externalId: string): string {
  return `https://www.linkedin.com/jobs/view/${externalId}`;
}

function findJobPosting(value: unknown): JsonObject | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return undefined;
  }
  if (!isObject(value)) return undefined;
  const typeValue = value["@type"];
  if (typeValue === "JobPosting" || (Array.isArray(typeValue) && typeValue.includes("JobPosting"))) return value;
  for (const nested of Object.values(value)) {
    const found = findJobPosting(nested);
    if (found) return found;
  }
  return undefined;
}

function parseStructuredJob($: CheerioAPI): JsonObject | undefined {
  let result: JsonObject | undefined;
  $("script[type='application/ld+json']").each((_index, element) => {
    if (result) return;
    try {
      result = findJobPosting(JSON.parse($(element).text()) as unknown);
    } catch {
      // One malformed script must not hide usable HTML or another valid JSON-LD block.
    }
  });
  return result;
}

function parseAddress(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value.map(parseAddress).filter((part): part is string => Boolean(part)).join("; ") || undefined;
  }
  if (typeof value === "string") return text(value);
  if (!isObject(value)) return undefined;
  const address = isObject(value.address) ? value.address : value;
  const countryValue = address.addressCountry;
  const country = isObject(countryValue) ? text(countryValue.name) : text(countryValue);
  return [text(address.addressLocality), text(address.addressRegion), country]
    .filter((part): part is string => Boolean(part))
    .join(", ") || undefined;
}

function parseSalary(value: unknown): LinkedInSalary | undefined {
  if (!isObject(value)) return undefined;
  const currency = text(value.currency);
  const quantitative = isObject(value.value) ? value.value : value;
  const min = typeof quantitative.minValue === "number" ? quantitative.minValue : undefined;
  const max = typeof quantitative.maxValue === "number" ? quantitative.maxValue : undefined;
  const exact = typeof quantitative.value === "number" ? quantitative.value : undefined;
  const unit = text(quantitative.unitText)?.toLowerCase();
  const resolvedMin = min ?? exact;
  const resolvedMax = max ?? exact;
  if (resolvedMin === undefined && resolvedMax === undefined && !currency) return undefined;
  const bounds = resolvedMin === resolvedMax || resolvedMax === undefined
    ? String(resolvedMin ?? resolvedMax ?? "")
    : `${resolvedMin ?? ""} - ${resolvedMax}`;
  return {
    min: resolvedMin,
    max: resolvedMax,
    currency,
    unit,
    text: [currency, bounds, unit ? `per ${unit}` : undefined].filter(Boolean).join(" "),
  };
}

function parseEmploymentType(value: unknown): string | undefined {
  const values = (Array.isArray(value) ? value : [value])
    .map((item) => text(item))
    .filter((item): item is string => Boolean(item));
  return values.map((item) => item.replaceAll("_", " ").toLowerCase()).join(", ") || undefined;
}

function parseCriteria($: CheerioAPI): Map<string, string> {
  const criteria = new Map<string, string>();
  $(LINKEDIN_SELECTORS.detailCriteriaItem.join(",")).each((_index, element) => {
    const root = $(element);
    const label = firstText($, root, LINKEDIN_SELECTORS.detailCriteriaLabel)?.toLowerCase();
    const value = firstText($, root, LINKEDIN_SELECTORS.detailCriteriaValue);
    if (label && value) criteria.set(label, value);
  });
  return criteria;
}

export function parseLinkedInSearchResults(html: string, now = new Date()): LinkedInSearchResult[] {
  const $ = load(html);
  const jobs = new Map<string, LinkedInSearchResult>();
  const selector = LINKEDIN_SELECTORS.searchCard.join(",");

  $(selector).each((_index, element) => {
    const root = $(element);
    const href = firstAttribute(root, LINKEDIN_SELECTORS.cardLink, "href");
    const urn = text(root.attr("data-entity-urn")) ?? text(root.find("[data-entity-urn]").attr("data-entity-urn"));
    const externalId = extractLinkedInJobId(urn) ?? extractLinkedInJobId(href);
    const title = firstText($, root, LINKEDIN_SELECTORS.cardTitle);
    const company = firstText($, root, LINKEDIN_SELECTORS.cardCompany);
    if (!externalId || !title || !company || jobs.has(externalId)) return;

    const postedElement = root.find(LINKEDIN_SELECTORS.cardPostedAt.join(",")).first();
    const workplaceText = firstText($, root, LINKEDIN_SELECTORS.cardWorkplaceType);
    const location = firstText($, root, LINKEDIN_SELECTORS.cardLocation);
    jobs.set(externalId, {
      externalId,
      title,
      company,
      companyUrl: firstAttribute(root, LINKEDIN_SELECTORS.cardCompanyLink, "href"),
      location,
      workplaceType: classifyWorkplace(workplaceText, location),
      jobUrl: canonicalLinkedInJobUrl(externalId),
      postedAt: parseRelativeDate(postedElement.attr("datetime") ?? text(postedElement.text()), now),
    });
  });

  return [...jobs.values()];
}

export function parseLinkedInJobDetail(html: string, fallback?: LinkedInSearchResult): LinkedInJobDetail | null {
  const $ = load(html);
  const structured = parseStructuredJob($);
  const body = $.root();
  const criteria = parseCriteria($);
  const identifier = isObject(structured?.identifier) ? structured.identifier.value : undefined;
  const identifierText = text(identifier);
  const canonicalHref = $(LINKEDIN_SELECTORS.canonicalLink.join(",")).first().attr("href");
  // The search-card ID is the identity used to request this page. Prefer it over
  // `identifier.value`, which LinkedIn sometimes populates with a non-job entity ID.
  const externalId = fallback?.externalId
    ?? extractLinkedInJobId(canonicalHref)
    ?? extractLinkedInJobId(text(structured?.url))
    ?? extractLinkedInJobId(identifierText)
    ?? (identifierText && /^\d+$/.test(identifierText) ? identifierText : undefined);
  const title = text(structured?.title) ?? firstText($, body, LINKEDIN_SELECTORS.detailTitle) ?? fallback?.title;
  const organization = isObject(structured?.hiringOrganization) ? structured.hiringOrganization : undefined;
  const company = text(organization?.name) ?? firstText($, body, LINKEDIN_SELECTORS.detailCompany) ?? fallback?.company;
  if (!externalId || !title || !company) return null;

  const structuredDescription = text(structured?.description);
  let description = structuredDescription ?? "";
  if (!description) {
    for (const selector of LINKEDIN_SELECTORS.detailDescription) {
      const element = $(selector).first();
      if (element.length) {
        description = element.html()?.trim() ?? text(element.text()) ?? "";
        if (description) break;
      }
    }
  }

  const location = parseAddress(structured?.jobLocation)
    ?? fallback?.location
    ?? firstText($, body, LINKEDIN_SELECTORS.detailLocation);
  const employmentType = parseEmploymentType(structured?.employmentType)
    ?? criteria.get("employment type");
  const seniority = criteria.get("seniority level");
  const salary = parseSalary(structured?.baseSalary);
  const salaryText = salary?.text ?? firstText($, body, LINKEDIN_SELECTORS.detailSalary);
  const enrichedDescription = [
    description,
    employmentType ? `Employment type: ${employmentType}` : undefined,
    seniority ? `Seniority level: ${seniority}` : undefined,
    salaryText ? `Salary: ${salaryText}` : undefined,
  ].filter(Boolean).join("\n");
  const workplaceType = classifyWorkplace(
    text(structured?.jobLocationType),
    text(structured?.description),
    fallback?.workplaceType,
    location,
  );

  return {
    externalId,
    title,
    company,
    companyUrl: text(organization?.sameAs) ?? text(organization?.url)
      ?? firstAttribute(body, LINKEDIN_SELECTORS.detailCompanyLink, "href")
      ?? fallback?.companyUrl,
    location,
    workplaceType,
    employmentType,
    seniority,
    salary: salary ?? (salaryText ? { text: salaryText } : undefined),
    description: enrichedDescription,
    jobUrl: canonicalLinkedInJobUrl(externalId),
    postedAt: parseDate(structured?.datePosted)
      ?? parseRelativeDate(firstAttribute(body, LINKEDIN_SELECTORS.detailPostedAt, "datetime")
        ?? firstText($, body, LINKEDIN_SELECTORS.detailPostedAt), new Date())
      ?? fallback?.postedAt,
    structuredData: structured,
  };
}

export function detectLinkedInAccessRestriction(html: string): "captcha" | "challenge" | "login" | undefined {
  const lower = html.toLowerCase();
  if (/captcha-internal|g-recaptcha|captcha challenge/.test(lower)) return "captcha";
  if (/\/checkpoint\/challenge|security verification|challenge-page/.test(lower)) return "challenge";
  if (/authwall|<title>\s*(?:sign in|join linkedin)|class=["'][^"']*login__form/.test(lower)) return "login";
  return undefined;
}
