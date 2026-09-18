/** Small shared helpers for case-insensitive, word-boundary-safe phrase matching. */

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function phraseMatches(lowerText: string, phrase: string): boolean {
  const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(phrase)}(?![a-z0-9])`, "i");
  return pattern.test(lowerText);
}

export function findFirstMatch(lowerText: string, phrases: readonly string[]): string | undefined {
  return phrases.find((phrase) => phraseMatches(lowerText, phrase));
}

export function findAllMatches(lowerText: string, phrases: readonly string[]): string[] {
  return phrases.filter((phrase) => phraseMatches(lowerText, phrase));
}
