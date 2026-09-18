import { describe, expect, it } from "vitest";
import { computeFingerprint } from "../src/fingerprint.js";

describe("computeFingerprint", () => {
  it("is deterministic for the same inputs", () => {
    const a = computeFingerprint("Acme Corp", "Senior Backend Engineer", "Remote (EU)");
    const b = computeFingerprint("Acme Corp", "Senior Backend Engineer", "Remote (EU)");
    expect(a).toBe(b);
  });

  it("is case- and whitespace-insensitive", () => {
    const a = computeFingerprint("Acme Corp", "Senior Backend Engineer", "Remote (EU)");
    const b = computeFingerprint("  acme   corp  ", "senior backend engineer", "remote (eu)");
    expect(a).toBe(b);
  });

  it("differs when any component differs", () => {
    const base = computeFingerprint("Acme Corp", "Senior Backend Engineer", "Remote (EU)");
    expect(computeFingerprint("Globex", "Senior Backend Engineer", "Remote (EU)")).not.toBe(base);
    expect(computeFingerprint("Acme Corp", "Senior Frontend Engineer", "Remote (EU)")).not.toBe(base);
    expect(computeFingerprint("Acme Corp", "Senior Backend Engineer", "Remote (US)")).not.toBe(base);
  });
});
