const COMPANY_LEGAL_SUFFIXES = [
  "inc",
  "incorporated",
  "llc",
  "ltd",
  "limited",
  "gmbh",
  "s.a.",
  "sa",
  "b.v.",
  "bv",
  "ag",
  "plc",
  "corp",
  "corporation",
  "co",
  "s.r.o.",
  "oy",
  "ab",
  "as",
];

/** Lowercases, strips punctuation and common legal-entity suffixes, collapses whitespace. */
export function normalizeCompanyName(name: string): string {
  let normalized = name
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/[^a-z0-9\s&-]/g, " ")
    .trim();

  for (const suffix of COMPANY_LEGAL_SUFFIXES) {
    const pattern = new RegExp(`(?:^|\\s)${suffix}$`);
    normalized = normalized.replace(pattern, "").trim();
  }

  return normalized.replace(/\s+/g, " ").trim();
}

/** Lowercases the host, strips "www.", strips query string/hash/trailing slash. */
export function normalizeApplyUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}
