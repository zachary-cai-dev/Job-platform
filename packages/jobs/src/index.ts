export type {
  ProcessingStatus,
  RemoteType,
  RawJobInput,
  UpsertRawJobInput,
  UpsertRawJobResult,
  ExistingJobSnapshot,
  ReconciledJobFields,
  NewJobRecord,
  ListingUpsertRecord,
  JobRepositoryPort,
  IngestOutcomeKind,
  IngestOutcome,
} from "./types.js";

export { ingestRawJobPayload, type IngestRawJobParams } from "./ingestRawJobPayload.js";
export { reconcileJobFields, type IncomingReconciliationFields } from "./reconciliation.js";
export { PrismaJobRepository } from "./prismaJobRepository.js";
export { stripHtml } from "./stripHtml.js";
export { computeChecksum } from "./checksum.js";
export { computeFingerprint } from "./fingerprint.js";
export { slugifyCompanyName } from "./companySlug.js";
