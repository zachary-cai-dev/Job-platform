import { describe, expect, it } from "vitest";
import { AppError, ExternalServiceError, NotFoundError, ValidationError } from "../src/errors.js";

describe("error hierarchy", () => {
  it("NotFoundError carries a stable code and a readable message", () => {
    const err = new NotFoundError("Job", "abc123");
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Job not found: abc123");
  });

  it("ValidationError carries its own code", () => {
    const err = new ValidationError("title is required");
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("ExternalServiceError preserves the underlying cause", () => {
    const cause = new Error("timeout");
    const err = new ExternalServiceError("greenhouse", "fetch failed", cause);
    expect(err.code).toBe("EXTERNAL_SERVICE_ERROR");
    expect(err.cause).toBe(cause);
    expect(err.message).toBe("greenhouse: fetch failed");
  });
});
