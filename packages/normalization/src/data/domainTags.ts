/**
 * Secondary, additive tags — scanned independently of the primary role-category
 * dictionary so a title like "Fullstack Software Developer - AI Platform" keeps
 * FULL_STACK_ENGINEER as its primary category but still picks up an "ai" tag.
 */
export const DOMAIN_TAGS: Array<{ tag: string; keywords: string[] }> = [
  { tag: "ai", keywords: ["ai", "artificial intelligence", "generative ai", "genai", "llm"] },
  { tag: "cloud", keywords: ["cloud"] },
  { tag: "data", keywords: ["data pipeline", "big data"] },
];
