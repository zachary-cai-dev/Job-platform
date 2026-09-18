// Built from numeric code points (rather than typed literally) to keep this file
// plain ASCII: U+0300 - U+036F is the Unicode "Combining Diacritical Marks" block,
// what `"é".normalize("NFKD")` decomposes to ("e" + a combining acute accent).
const COMBINING_MARKS_START = String.fromCharCode(0x0300);
const COMBINING_MARKS_END = String.fromCharCode(0x036f);
const COMBINING_DIACRITICAL_MARKS = new RegExp(`[${COMBINING_MARKS_START}-${COMBINING_MARKS_END}]`, "g");

/** Deterministic slug for `Company.slug` — used as the upsert key when a new company is first seen. */
export function slugifyCompanyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_DIACRITICAL_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
