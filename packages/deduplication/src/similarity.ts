function trigrams(value: string): Set<string> {
  const padded = `  ${value.toLowerCase().trim()}  `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

/**
 * Dice coefficient over character trigrams — a dependency-free stand-in for
 * Postgres `pg_trgm`'s `similarity()`, close enough in behavior for scoring
 * purposes and for this package's pure unit tests. The production candidate
 * query in `packages/jobs` uses real `pg_trgm` at the database layer; this
 * function is what re-scores the small candidate set that query returns.
 */
export function trigramSimilarity(a: string, b: string): number {
  if (!a.trim() || !b.trim()) return 0;
  const setA = trigrams(a);
  const setB = trigrams(b);
  let intersection = 0;
  for (const gram of setA) {
    if (setB.has(gram)) intersection++;
  }
  return (2 * intersection) / (setA.size + setB.size);
}
