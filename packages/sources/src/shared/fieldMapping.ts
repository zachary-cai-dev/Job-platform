import type { RawJobPayload } from "../types.js";

export function toRemoteType(value: unknown): RawJobPayload["remoteType"] {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("hybrid")) return "HYBRID";
  if (normalized.includes("remote") || normalized === "true") return "FULLY_REMOTE";
  return "UNKNOWN";
}

export function toEmploymentType(value: unknown): RawJobPayload["employmentType"] {
  const normalized = String(value ?? "").toLowerCase().replace(/[_-]/g, " ");
  if (normalized.includes("intern")) return "INTERNSHIP";
  if (normalized.includes("part time") || normalized.includes("parttime")) return "PART_TIME";
  if (normalized.includes("freelance")) return "FREELANCE";
  if (normalized.includes("contract") || normalized.includes("temporary")) return "CONTRACT";
  if (normalized.includes("full time") || normalized.includes("permanent")) return "PERMANENT";
  return undefined;
}

export function toSalaryPeriod(value: unknown): RawJobPayload["salaryPeriod"] {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("hour")) return "HOURLY";
  if (normalized.includes("day")) return "DAILY";
  if (normalized.includes("month")) return "MONTHLY";
  if (normalized.includes("year") || normalized.includes("annual")) return "YEARLY";
  return undefined;
}

export function asNumber(value: unknown): number | undefined {
  const normalized = typeof value === "number" ? value : String(value ?? "").replace(/[^\d.-]/g, "");
  if (normalized === "") return undefined;
  const parsed = typeof normalized === "number" ? normalized : Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

export function validDate(value: unknown): Date | undefined {
  if (value == null || value === "") return undefined;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}
