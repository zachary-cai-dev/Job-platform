import { describe, expect, it } from "vitest";
import { stripHtml } from "../src/stripHtml.js";

describe("stripHtml", () => {
  it("removes tags and decodes common entities", () => {
    expect(stripHtml("<p>Hello &amp; welcome</p>")).toBe("Hello & welcome");
  });

  it("converts block-level tags into line breaks", () => {
    const result = stripHtml("<p>First</p><p>Second</p>");
    expect(result).toBe("First\nSecond");
  });

  it("strips script and style content entirely, not just the tags", () => {
    const result = stripHtml("<p>Visible</p><script>alert('x')</script><style>.a{color:red}</style>");
    expect(result).toBe("Visible");
  });

  it("passes plain text through unchanged (idempotent for non-HTML sources)", () => {
    const plain = "Join our platform team working with Go, PostgreSQL and Kubernetes.";
    expect(stripHtml(plain)).toBe(plain);
  });

  it("returns an empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });

  it("collapses excessive blank lines", () => {
    const result = stripHtml("<p>A</p><br><br><br><p>B</p>");
    expect(result).not.toMatch(/\n{3,}/);
  });
});
