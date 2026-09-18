/** Base class for all application errors — every subclass carries a stable `code`. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

/** Wraps a failure from a source adapter, the queue, or any other outside system. */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, cause?: unknown) {
    super(`${service}: ${message}`, "EXTERNAL_SERVICE_ERROR", cause);
    this.name = "ExternalServiceError";
  }
}
