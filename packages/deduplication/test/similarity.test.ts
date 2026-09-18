import { describe, expect, it } from "vitest";
import { trigramSimilarity } from "../src/similarity.js";

describe("trigramSimilarity", () => {
  it("is 1 for identical strings", () => {
    expect(trigramSimilarity("Senior Backend Engineer", "Senior Backend Engineer")).toBe(1);
  });

  it("is 0 for completely unrelated strings", () => {
    expect(trigramSimilarity("abc", "xyz")).toBe(0);
  });

  it("is 0 when either input is blank", () => {
    expect(trigramSimilarity("", "Senior Backend Engineer")).toBe(0);
    expect(trigramSimilarity("Senior Backend Engineer", "")).toBe(0);
  });

  it("ranks a near-duplicate higher than an unrelated string", () => {
    const near = trigramSimilarity(
      "Senior Backend Engineer",
      "Senior Backend Engineer (Remote)",
    );
    const unrelated = trigramSimilarity("Senior Backend Engineer", "Marketing Intern");
    expect(near).toBeGreaterThan(unrelated);
  });

  it("is case-insensitive", () => {
    expect(trigramSimilarity("REACT DEVELOPER", "react developer")).toBe(1);
  });
});
