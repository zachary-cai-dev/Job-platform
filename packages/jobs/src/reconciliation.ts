import type { SalaryPeriod } from "@euro-jobs/normalization";
import type { ExistingJobSnapshot, ReconciledJobFields } from "./types.js";

export interface IncomingReconciliationFields {
  postedAt: Date | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
}

type ExistingReconciliationSnapshot = Pick<
  ExistingJobSnapshot,
  "postedAt" | "postedAtIsInferred" | "salaryMin" | "salaryMax" | "salaryCurrency" | "salaryPeriod"
>;

/**
 * Field reconciliation policy for a merge/update (docs/ingestion.md §7.4):
 *  - postedAt: a real date always beats an inferred one; between two real dates,
 *    the earliest wins (the true original posting date); an inferred `postedAt`
 *    never changes an already-inferred value except by acquiring a real one.
 *  - salary: filled in only when the canonical Job doesn't have it yet — never
 *    overwritten once set, so one source's vaguer figure can't clobber another's
 *    precise one.
 *  - description is deliberately NOT reconciled here — first-write-wins, untouched
 *    on merge (see docs/ingestion.md §7.4); callers simply don't update it.
 */
export function reconcileJobFields(
  existing: ExistingReconciliationSnapshot,
  incoming: IncomingReconciliationFields,
  now: Date,
): ReconciledJobFields {
  let postedAt: Date;
  let postedAtIsInferred: boolean;

  if (existing.postedAtIsInferred && incoming.postedAt) {
    postedAt = incoming.postedAt;
    postedAtIsInferred = false;
  } else if (
    !existing.postedAtIsInferred &&
    incoming.postedAt &&
    existing.postedAt &&
    incoming.postedAt.getTime() < existing.postedAt.getTime()
  ) {
    postedAt = incoming.postedAt;
    postedAtIsInferred = false;
  } else if (existing.postedAt) {
    postedAt = existing.postedAt;
    postedAtIsInferred = existing.postedAtIsInferred;
  } else {
    postedAt = now;
    postedAtIsInferred = true;
  }

  const hasExistingSalary = existing.salaryMin != null && existing.salaryMax != null;

  return {
    postedAt,
    postedAtIsInferred,
    salaryMin: hasExistingSalary ? existing.salaryMin : incoming.salaryMin,
    salaryMax: hasExistingSalary ? existing.salaryMax : incoming.salaryMax,
    salaryCurrency: hasExistingSalary ? existing.salaryCurrency : incoming.salaryCurrency,
    salaryPeriod: hasExistingSalary ? existing.salaryPeriod : incoming.salaryPeriod,
  };
}
