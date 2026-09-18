import { createHash } from "node:crypto";

/** Stable content hash used for RawJob idempotency (docs/data-model.md §5). */
export function computeChecksum(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
