import { describe, expect, it } from "vitest";
import { createLogger, withIngestionContext } from "../src/logger.js";

describe("createLogger", () => {
  it("creates a pino logger with the given name and level", () => {
    const logger = createLogger("test-service", "debug");
    expect(logger.level).toBe("debug");
    expect(logger.bindings().name).toBe("test-service");
  });

  it("defaults to info level", () => {
    const logger = createLogger("test-service");
    expect(logger.level).toBe("info");
  });
});

describe("withIngestionContext", () => {
  it("attaches ingestion correlation ids as a child logger", () => {
    const logger = createLogger("worker");
    const child = withIngestionContext(logger, {
      ingestionRunId: "run-1",
      source: "greenhouse",
      externalJobId: "ext-1",
    });
    expect(child.bindings()).toMatchObject({
      ingestionRunId: "run-1",
      source: "greenhouse",
      externalJobId: "ext-1",
    });
  });
});
