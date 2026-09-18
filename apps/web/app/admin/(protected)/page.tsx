import { StatusBadge } from "@/components/StatusBadge";
import { getAdminOverview } from "@/lib/adminData";
import { formatRelativeTime } from "@/lib/relativeTime";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular-nums font-medium text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Per-source ingestion health (brief §31) — sourced entirely from `IngestionRun`
 * rows the worker already writes (docs/data-model.md §9); nothing here is computed
 * specially for the admin view.
 */
export default async function AdminPage() {
  const overview = await getAdminOverview();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-lg font-semibold text-foreground">Ingestion admin</h1>

      <div className="mt-4 flex gap-8 rounded-lg border border-border bg-card p-4">
        <Stat label="Active jobs" value={overview.totalActiveJobs.toLocaleString()} />
        <Stat label="Companies" value={overview.totalCompanies.toLocaleString()} />
        <Stat label="Sources" value={overview.sources.length} />
      </div>

      <div className="mt-6 space-y-3">
        {overview.sources.map((source) => (
          <div key={source.slug} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="font-medium text-foreground">{source.displayName}</h2>
                <StatusBadge status={source.status} />
                {source.lastRun && <StatusBadge status={source.lastRun.status} />}
              </div>
              <span className="text-xs text-muted-foreground">{source.integrationMethod}</span>
            </div>

            {!source.lastRun ? (
              <p className="mt-2 text-sm text-muted-foreground">No ingestion runs yet.</p>
            ) : (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last {source.lastRun.status === "RUNNING" ? "started" : "sync"}:{" "}
                  {formatRelativeTime(source.lastRun.startedAt)}
                  {source.lastRun.durationMs != null && ` · ${(source.lastRun.durationMs / 1000).toFixed(1)}s`}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 lg:grid-cols-8">
                  <Stat label="Fetched" value={source.lastRun.fetchedCount} />
                  <Stat label="Europe eligible" value={source.lastRun.europeEligibleCount} />
                  <Stat label="Rejected: location" value={source.lastRun.rejectedGeographyCount} />
                  <Stat label="Rejected: role" value={source.lastRun.rejectedRoleCategoryCount} />
                  <Stat label="New" value={source.lastRun.createdCount} />
                  <Stat label="Updated" value={source.lastRun.updatedCount} />
                  <Stat label="Duplicates" value={source.lastRun.duplicateCount} />
                  <Stat label="Errors" value={source.lastRun.errorCount} />
                </dl>
                {source.lastRun.errorCount > 0 && Boolean(source.lastRun.errorSample) && (
                  <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    {JSON.stringify(source.lastRun.errorSample, null, 2)}
                  </pre>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
