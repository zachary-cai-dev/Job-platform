import { describe, expect, it } from "vitest";
import { extractTechnologies } from "../src/technologyExtraction.js";

function slugsOf(text: string): string[] {
  return extractTechnologies(text)
    .map((t) => t.slug)
    .sort();
}

describe("extractTechnologies", () => {
  it("extracts a realistic stack list", () => {
    const slugs = slugsOf("Tech stack: React, TypeScript, Node.js, PostgreSQL, AWS, Docker, Kubernetes");
    expect(slugs).toEqual(
      ["AWS", "DOCKER", "KUBERNETES", "NODE_JS", "POSTGRESQL", "REACT", "TYPESCRIPT"].sort(),
    );
  });

  it("normalizes Node.js aliases to one canonical slug with the display name 'Node.js'", () => {
    for (const text of ["Node.js", "NodeJS", "Node"]) {
      const [tech] = extractTechnologies(`Experience with ${text} required`);
      expect(tech?.slug).toBe("NODE_JS");
      expect(tech?.displayName).toBe("Node.js");
    }
  });

  it("matches Go only as an exact-case token, not the ordinary verb", () => {
    expect(slugsOf("We use Go and Kubernetes")).toContain("GOLANG");
    expect(slugsOf("Feel free to go ahead and apply")).not.toContain("GOLANG");
  });

  it("matches AI/RAG/LLM stack terms", () => {
    const slugs = slugsOf("Experience with LLMs, RAG pipelines, LangChain and OpenAI's API");
    expect(slugs).toEqual(["LANGCHAIN", "LLM", "OPENAI", "RAG"].sort());
  });

  it("only matches Claude via a clearly product-referring phrase, not a bare first name", () => {
    expect(slugsOf("Our hiring manager Claude will be in touch")).not.toContain("CLAUDE");
    expect(slugsOf("Experience integrating with Claude AI or OpenAI")).toContain("CLAUDE");
  });

  it("deduplicates repeated mentions into a single entry", () => {
    const result = extractTechnologies("Python, python, PYTHON");
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("PYTHON");
  });

  it("returns an empty array for text with no technology mentions", () => {
    expect(extractTechnologies("We are a friendly team that loves coffee")).toEqual([]);
  });

  it("scans across multiple text fields (title + description)", () => {
    const slugs = extractTechnologies("Senior React Engineer", "You will use GraphQL and PostgreSQL daily")
      .map((t) => t.slug)
      .sort();
    expect(slugs).toEqual(["POSTGRESQL", "REACT"]);
  });
});
