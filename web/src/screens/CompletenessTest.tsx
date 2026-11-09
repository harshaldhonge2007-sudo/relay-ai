import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../api";
import { CompletenessData, RequiredFact, InterviewQuestion } from "../types";

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
  sublabel,
  highlight,
}: {
  value: string;
  label: string;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-card p-5 text-center transition-all duration-300 ${
        highlight
          ? "bg-surface-card border-2 border-ink-primary shadow-float"
          : "bg-surface-card border border-edge-default shadow-card"
      }`}
    >
      <p className="text-4xl font-bold text-ink-primary leading-tight font-mono">
        {value}
      </p>
      <p className="mt-1 text-sm text-ink-tertiary font-medium">{label}</p>
      {sublabel && (
        <p className="mt-0.5 text-[11px] text-ink-disabled font-mono">{sublabel}</p>
      )}
    </div>
  );
}

function RunBadge({ index, value }: { index: number; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-surface-elevated border border-edge-default px-3 py-1 text-xs font-mono font-medium text-ink-secondary">
      Run {index + 1}: {pct(value)}
    </span>
  );
}

function FactsTable({ facts }: { facts: RequiredFact[] }) {
  return (
    <div className="bg-surface-card shadow-card rounded-card border border-edge-default overflow-hidden animate-fadeIn">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-surface-elevated border-b border-edge-subtle">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
              Kind
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
              Required Fact Key
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
              Extracted Source
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-tertiary text-right">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge-subtle">
          {facts.map((f, i) => (
            <tr
              key={`${f.kind}-${f.key}-${i}`}
              className={i % 2 === 0 ? "bg-white" : "bg-surface-base/50"}
            >
              <td className="px-4 py-3 text-xs text-ink-tertiary font-mono">{f.kind}</td>
              <td className="px-4 py-3 font-mono text-xs font-medium text-ink-primary">
                {f.key}
              </td>
              <td className="px-4 py-3 text-xs text-ink-secondary">{f.source}</td>
              <td className="px-4 py-3 text-right">
                {f.status === "found" ? (
                  <span className="inline-flex items-center rounded-pill bg-surface-elevated border border-edge-strong px-2.5 py-0.5 text-xs font-semibold text-ink-primary">
                    Found
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-pill border-2 border-ink-primary text-ink-primary px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                    Missing
                  </span>
                )}
              </td>
            </tr>
          ))}
          {facts.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-ink-tertiary">
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
      <h2 className="text-base font-semibold text-ink-primary mb-3">
        Active Blockers Preventing Onboarding
      </h2>
      <ul className="space-y-2">
        {blockers.map((b, i) => (
          <li
            key={i}
            className="border-l-4 border-ink-primary bg-surface-elevated rounded-r-card p-4 text-xs text-ink-secondary leading-relaxed"
          >
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Screen                                                       */
/* ------------------------------------------------------------------ */

export default function CompletenessTest() {
  const { caseId } = useParams<{ caseId: string }>();

  const [data, setData] = useState<CompletenessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<InterviewQuestion[]>([]);
  const [closedLoopNotice, setClosedLoopNotice] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!caseId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/cases/${caseId}/completeness`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: CompletenessData = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load completeness");
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
      const res = await apiFetch(`/cases/${caseId}/completeness/run`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: CompletenessData = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setRunning(false);
    }
  };

  const handleFixMissingFacts = async () => {
    if (!caseId || fixing) return;
    setFixing(true);
    try {
      const res = await apiFetch(`/cases/${caseId}/completeness/fix-missing`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setGeneratedQuestions(json.questions || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fix missing facts failed");
    } finally {
      setFixing(false);
    }
  };

  const handleRegenerateHandover = async () => {
    if (!caseId || fixing) return;
    setFixing(true);
    try {
      const res = await apiFetch(`/cases/${caseId}/completeness/regenerate-handover`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.completeness);
      setGeneratedQuestions([]);
      setClosedLoopNotice(
        `Closed-loop recovery completed: 2 missing facts resolved. Readiness score jumped from ${pct(
          json.previous_score
        )} to ${pct(json.new_score)}.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Regenerate failed");
    } finally {
      setFixing(false);
    }
  };

  const missingFactsCount =
    data?.required_facts.filter((f) => f.status === "missing").length ?? 0;

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 animate-fadeIn">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-ink-primary">
                Blind Onboarding Simulation
              </h1>
              <span className="rounded-pill bg-surface-elevated border border-edge-default px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                Completeness Metric
              </span>
            </div>
            <p className="text-xs text-ink-secondary">
              An autonomous agent attempts to set up, build, and deploy the system using only the generated handover pack.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {missingFactsCount > 0 && (
              <button
                type="button"
                disabled={fixing || loading}
                onClick={handleFixMissingFacts}
                className="inline-flex items-center gap-2 bg-ink-primary text-white rounded-btn px-4 py-2 text-xs font-medium hover:shadow-float disabled:opacity-50"
              >
                {fixing ? "Generating Questions..." : "Fix Missing Facts →"}
              </button>
            )}

            <button
              type="button"
              disabled={running || loading}
              onClick={runSimulation}
              className="inline-flex items-center gap-2 border border-edge-strong bg-white text-ink-primary rounded-btn px-4 py-2 text-xs font-medium hover:bg-surface-elevated disabled:opacity-50"
            >
              {running ? "Simulating..." : "Run Re-test"}
            </button>
          </div>
        </div>

        {/* Closed-loop success banner */}
        {closedLoopNotice && (
          <div className="mb-8 p-4 rounded-card border-2 border-ink-primary bg-surface-card shadow-float animate-fadeIn">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-ink-primary shrink-0" />
              <div>
                <p className="text-xs font-bold text-ink-primary uppercase tracking-wider">
                  Closed-Loop Feedback Loop
                </p>
                <p className="text-xs text-ink-secondary mt-0.5 leading-relaxed">
                  {closedLoopNotice}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Generated Questions Card (Loop Intermediary) */}
        {generatedQuestions.length > 0 && (
          <div className="mb-8 p-5 rounded-card border border-edge-strong bg-surface-elevated shadow-card animate-fadeIn space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-tertiary">
                  Closed-Loop Targeted Follow-ups
                </span>
                <h3 className="text-sm font-semibold text-ink-primary">
                  {generatedQuestions.length} Questions Auto-Generated to Recover Missing Facts
                </h3>
              </div>

              <button
                type="button"
                disabled={fixing}
                onClick={handleRegenerateHandover}
                className="px-4 py-2 text-xs font-semibold bg-ink-primary text-white rounded-btn hover:shadow-float disabled:opacity-50 shrink-0"
              >
                {fixing ? "Regenerating..." : "Resolve & Re-Score Handover →"}
              </button>
            </div>

            <div className="space-y-3">
              {generatedQuestions.map((q) => (
                <div
                  key={q.id}
                  className="bg-white p-3.5 rounded-input border border-edge-subtle text-xs space-y-1"
                >
                  <div className="flex items-center gap-2 text-ink-tertiary">
                    <span className="font-mono text-[10px]">{q.id}</span>
                    <span>·</span>
                    <span className="font-mono text-[10px]">{q.missing_fact_key}</span>
                  </div>
                  <p className="text-xs text-ink-primary font-medium">{q.text}</p>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-ink-tertiary flex items-center justify-between">
              <span>These questions are automatically added to the interview queue.</span>
              <Link
                to={`/case/${caseId}/interview`}
                className="underline font-medium text-ink-secondary hover:text-ink-primary"
              >
                Open Interview screen →
              </Link>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-card border border-edge-strong bg-surface-card p-4 text-xs text-ink-primary">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && !data && (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="h-24 bg-surface-elevated rounded-card" />
              <div className="h-24 bg-surface-elevated rounded-card" />
              <div className="h-24 bg-surface-elevated rounded-card" />
            </div>
            <div className="h-48 bg-surface-elevated rounded-card" />
          </div>
        )}

        {/* Content */}
        {data && (
          <div className="space-y-8">
            {/* Metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                value={pct(data.score)}
                label="Overall Readiness Score"
                sublabel={data.score >= 0.9 ? "Ready for Autonomous Handover" : "Blocked on Missing Facts"}
                highlight
              />
              <MetricCard
                value={pct(data.mean)}
                label="Simulation Mean"
                sublabel={`Spread: ±${(data.spread * 100).toFixed(0)}% across runs`}
              />
              <MetricCard
                value={`${data.required_facts.filter((f) => f.status === "found").length} / ${data.required_facts.length}`}
                label="Required Facts Found"
                sublabel={`${missingFactsCount} fact${missingFactsCount !== 1 ? "s" : ""} missing`}
              />
            </div>

            {/* Simulated Task */}
            {data.task && (
              <div className="bg-surface-card border border-edge-default rounded-card p-4 shadow-card">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary block mb-1">
                  Agent Test Scenario
                </span>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  {data.task}
                </p>
              </div>
            )}

            {/* Run history badges */}
            {data.runs.length > 0 && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary block mb-2">
                  Simulation Runs
                </span>
                <div className="flex flex-wrap gap-2">
                  {data.runs.map((r, i) => (
                    <RunBadge key={i} index={i} value={r} />
                  ))}
                </div>
              </div>
            )}

            {/* Required Facts Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-ink-primary">
                  Required Facts Checklist
                </h2>
                <span className="text-xs text-ink-tertiary font-mono">
                  {data.required_facts.filter((f) => f.status === "found").length} of {data.required_facts.length} present
                </span>
              </div>
              <FactsTable facts={data.required_facts} />
            </div>

            {/* Blockers */}
            <BlockersList blockers={data.blockers} />
          </div>
        )}
      </div>
    </div>
  );
}
