import { describe, expect, it } from "vitest";
import { findBestMatch } from "../src/findBestMatch.js";
import type { JobCandidate } from "../src/types.js";

function job(overrides: Partial<JobCandidate>): JobCandidate {
  return {
    id: "base",
    companyName: "Acme Corp",
    normalizedTitle: "Senior Backend Engineer",
    applyUrl: "https://boards.greenhouse.io/acme/jobs/12345",
    descriptionText:
      "We are looking for a Senior Backend Engineer to join our platform team, working with Go, PostgreSQL and Kubernetes to build reliable APIs at scale.",
    eligibleCountries: ["DE"],
    eligibleRegions: ["EU", "EEA", "EUROPE", "EMEA"],
    geographyConfidence: "HIGH",
    ...overrides,
  };
}

describe("findBestMatch — brief §34 test matrix", () => {
  it("merges the same job re-discovered via a different source (e.g. LinkedIn vs Greenhouse)", () => {
    const existing = job({ id: "existing-greenhouse" });
    const incoming = job({
      id: "incoming-linkedin",
      applyUrl: "https://www.linkedin.com/jobs/view/98765",
      descriptionText:
        "We are looking for a Senior Backend Engineer to join our platform team, working with Go, PostgreSQL, and Kubernetes to build reliable APIs at scale.",
    });

    const decision = findBestMatch(incoming, [existing]);

    expect(decision.action).toBe("MERGE");
    expect(decision.matchedCandidateId).toBe("existing-greenhouse");
  });

  it("does not merge the same title at a different company", () => {
    const existing = job({ id: "existing-acme" });
    const incoming = job({
      id: "incoming-globex",
      companyName: "Globex International",
      applyUrl: "https://jobs.lever.co/globex/abcde",
      descriptionText:
        "Globex is hiring a Senior Backend Engineer to modernize our billing platform using Java and Oracle.",
    });

    const decision = findBestMatch(incoming, [existing]);

    expect(decision.action).toBe("CREATE_NEW");
  });

  it("does not merge a different role at the same company", () => {
    const existing = job({ id: "existing-backend" });
    const incoming = job({
      id: "incoming-data-scientist",
      normalizedTitle: "Senior Data Scientist",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/99999",
      descriptionText:
        "Acme is hiring a Senior Data Scientist to build churn-prediction models using Python, pandas and scikit-learn.",
    });

    const decision = findBestMatch(incoming, [existing]);

    expect(decision.action).toBe("CREATE_NEW");
  });

  it("does not merge the same title/company when locations are materially different (narrow, disjoint)", () => {
    const existing = job({ id: "existing-germany", eligibleCountries: ["DE"] });
    const incoming = job({
      id: "incoming-spain",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/55555",
      eligibleCountries: ["ES"],
    });

    const decision = findBestMatch(incoming, [existing]);

    expect(decision.action).toBe("CREATE_NEW");
    expect(decision.vetoed).toHaveLength(1);
    expect(decision.vetoed[0]?.candidateId).toBe("existing-germany");
  });

  it("an exact apply URL match always merges, even with no other candidates scoring high", () => {
    const existing = job({ id: "existing-url", applyUrl: "https://boards.greenhouse.io/acme/jobs/1?utm=x" });
    const incoming = job({
      id: "incoming-url",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/1?utm=y&ref=z",
      companyName: "Acme Corp (rebranded listing)",
    });

    const decision = findBestMatch(incoming, [existing]);

    expect(decision.action).toBe("MERGE");
    expect(decision.matchedCandidateId).toBe("existing-url");
  });

  it("a broad region match (e.g. EMEA) never triggers the narrow-location veto", () => {
    const existing = job({
      id: "existing-emea",
      eligibleCountries: [],
      eligibleRegions: ["EMEA"],
    });
    const incoming = job({
      id: "incoming-germany",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/77777",
      eligibleCountries: ["DE"],
      eligibleRegions: ["EU", "EEA", "EUROPE", "EMEA"],
    });

    const decision = findBestMatch(incoming, [existing]);

    expect(decision.vetoed).toHaveLength(0);
    expect(decision.action).toBe("MERGE");
  });

  it("returns CREATE_NEW with no candidates", () => {
    const decision = findBestMatch(job({ id: "solo" }), []);
    expect(decision.action).toBe("CREATE_NEW");
    expect(decision.matchedCandidateId).toBeNull();
  });
});
