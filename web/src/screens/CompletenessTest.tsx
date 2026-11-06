import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface RequiredFact {
  kind: string;
  key: string;
  source: string;
  status: "found" | "missing";
}

interface CompletenessData {
  task: string;
  score: number;
  mean: number;
  spread: number;
  runs: number[];
  required_facts: RequiredFact[];
  blockers: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function MetricCard({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="bg-surface-card shadow-card rounded-card p-5 text-center animate-fadeIn">
      <p className="text-4xl font-bold text-ink-primary leading-tight">
        {value}
      </p>
      <p className="mt-1 text-sm text-ink-tertiary">{label}</p>
    </div>
  );
}

function RunBadge({ index, value }: { index: number; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-surface-elevated border border-edge-default px-3 py-1 text-xs font-medium text-ink-secondary">
      Run {index + 1}: {pct(value)}
    </span>
  );
}

function FactsTable({ facts }: { facts: RequiredFact[] }) {
  return (
    <div className="bg-surface-card shadow-card rounded-card overflow-hidden animate-fadeIn">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-surface-elevated">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
              Kind
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
              Key
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
              Source
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {facts.map((f, i) => (
            <tr
              key={`${f.kind}-${f.key}-${i}`}
              className={i % 2 === 0 ? "bg-white" : "bg-surface-base"}
            >
              <td className="px-4 py-3 text-ink-secondary">{f.kind}</td>
              <td className="px-4 py-3 font-medium text-ink-primary">
                {f.key}
              </td>
              <td className="px-4 py-3 text-ink-secondary">{f.source}</td>
              <td className="px-4 py-3">
                {f.status === "found" ? (
                  <span className="font-medium text-ink-primary">Found</span>
                ) : (
                  <span className="font-bold text-ink-primary underline">
                    Missing
                  </span>
                )}
              </td>
            </tr>
          ))}
          {facts.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-8 text-center text-ink-tertiary"
              >
                No required facts recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function BlockersList({ blockers }: { blockers: string[] }) {
  if (blockers.length === 0) return null;

  return (
    <div className="animate-fadeIn">
      <h2 className="text-lg font-semibold text-ink-primary mb-3">Blockers</h2>
      <ul className="space-y-2">
        {blockers.map((b, i) => (
          <li
            key={i}
            className="border-l-4 border-ink-primary bg-surface-elevated rounded-r-card p-4 text-sm text-ink-secondary"
          >
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton loader                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="bg-surface-card shadow-card rounded-card p-5 text-center"
          >
            <div className="mx-auto h-10 w-20 rounded-lg bg-surface-elevated animate-pulse" />
            <div className="mx-auto mt-2 h-4 w-24 rounded bg-surface-elevated animate-pulse" />
          </div>
        ))}
      </div>
      <div className="h-16 rounded-card bg-surface-elevated animate-pulse" />
      <div className="h-48 rounded-card bg-surface-elevated animate-pulse" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main screen                                                       */
/* ------------------------------------------------------------------ */

export default function CompletenessTest() {
  const { caseId } = useParams<{ caseId: string }>();

  const [data, setData] = useState<CompletenessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const fetchData = useCallback(async () => {
    if (!caseId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/cases/${caseId}/completeness`);
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const json: CompletenessData = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const runSimulation = async () => {
    if (!caseId || running) return;
    try {
      setRunning(true);
      const res = await fetch(`/api/cases/${caseId}/completeness/run`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const json: CompletenessData = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to run simulation"
      );
    } finally {
      setRunning(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fadeIn">
          <h1 className="text-2xl font-semibold text-ink-primary">
            Completeness Test
          </h1>

          <button
            type="button"
            disabled={running || loading}
            onClick={runSimulation}
            className="inline-flex items-center justify-center gap-2 bg-ink-primary text-white rounded-btn px-5 py-2.5 text-sm font-medium
                       transition-all duration-200 hover:-translate-y-px hover:shadow-float
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none
                       focus:outline-none focus:ring-2 focus:ring-ink-primary focus:ring-offset-2"
          >
            {running && (
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            )}
            {running ? "Running..." : "Run New Simulation"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-card border border-edge-strong bg-surface-card p-4 text-sm text-ink-primary animate-fadeIn">
            <span className="font-semibold">Error: </span>
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && <Skeleton />}

        {/* Content */}
        {data && (
          <div className="space-y-8">
            {/* Metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard value={pct(data.score)} label="Overall Score" />
              <MetricCard value={pct(data.mean)} label="Mean Score" />
              <MetricCard
                value={data.spread.toFixed(2)}
                label="Spread"
              />
            </div>

            {/* Task description */}
            {data.task && (
              <div className="animate-fadeIn">
                <h2 className="text-lg font-semibold text-ink-primary mb-3">
                  Task
                </h2>
                <div className="bg-surface-elevated rounded-card p-4 text-sm text-ink-secondary leading-relaxed">
                  {data.task}
                </div>
              </div>
            )}

            {/* Run history */}
            {data.runs.length > 0 && (
              <div className="animate-fadeIn">
                <h2 className="text-lg font-semibold text-ink-primary mb-3">
                  Run History
                </h2>
                <div className="flex flex-wrap gap-2">
                  {data.runs.map((r, i) => (
                    <RunBadge key={i} index={i} value={r} />
                  ))}
                </div>
              </div>
            )}

            {/* Required Facts */}
            {data.required_facts.length > 0 && (
              <div className="animate-fadeIn">
                <h2 className="text-lg font-semibold text-ink-primary mb-3">
                  Required Facts
                </h2>
                <FactsTable facts={data.required_facts} />
              </div>
            )}

            {/* Blockers */}
            <BlockersList blockers={data.blockers} />
          </div>
        )}

        {/* Empty state */}
        {!loading && !data && !error && (
          <div className="text-center py-16 animate-fadeIn">
            <p className="text-ink-tertiary text-sm">
              No completeness data available. Run a simulation to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
