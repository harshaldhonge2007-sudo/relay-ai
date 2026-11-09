import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { UncertaintyData } from "../types";
import { useEvidenceDrawer } from "../components/EvidenceDrawer";

export default function Uncertainty() {
  const { caseId } = useParams<{ caseId: string }>();
  const [data, setData] = useState<UncertaintyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { openDrawer } = useEvidenceDrawer();

  const loadData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/cases/${caseId}/uncertainty`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: UncertaintyData = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load uncertainty data");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const inspectEvidence = async (artifactId: string, highlight?: string) => {
    try {
      const res = await apiFetch(`/artifacts/${artifactId}`);
      if (res.ok) {
        const art = await res.json();
        openDrawer([{ ...art, highlight }], art.title);
      } else {
        openDrawer([{ artifact_id: artifactId, withheld: true }], artifactId);
      }
    } catch {
      openDrawer([{ artifact_id: artifactId, withheld: true }], artifactId);
    }
  };

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 animate-fadeIn">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold text-ink-primary">
              Uncertainty & Gaps
            </h1>
            <span className="rounded-pill bg-surface-elevated border border-edge-default px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              What We Don't Know
            </span>
          </div>
          <p className="text-sm text-ink-secondary leading-relaxed">
            Honest boundaries of extracted knowledge. The system highlights missing evidence, unresolved contradictions, and unanswered questions instead of hallucinating answers.
          </p>
        </div>

        {loading && (
          <div className="space-y-6 animate-pulse">
            <div className="h-28 bg-surface-elevated rounded-card" />
            <div className="h-44 bg-surface-elevated rounded-card" />
          </div>
        )}

        {error && (
          <div className="bg-surface-card border border-edge-strong rounded-card p-6 text-center shadow-card">
            <p className="text-sm text-ink-primary font-medium mb-1">Error</p>
            <p className="text-xs text-ink-tertiary mb-4">{error}</p>
            <button
              onClick={loadData}
              className="bg-ink-primary text-white text-xs font-medium px-4 py-2 rounded-btn"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-10">
            {/* Section 1: Conflicts & Contradictions */}
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-edge-default">
                <div>
                  <h2 className="text-lg font-semibold text-ink-primary">
                    Cross-Source Contradictions
                  </h2>
                  <p className="text-xs text-ink-tertiary">
                    When two official sources disagree, both are preserved side-by-side.
                  </p>
                </div>
                <span className="rounded-pill bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
                  {data.conflicts.length}
                </span>
              </div>

              <div className="space-y-4">
                {data.conflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    className="bg-surface-card border border-edge-default rounded-card p-5 shadow-card space-y-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wider text-ink-primary">
                          Contradiction
                        </span>
                        <span className="text-xs text-ink-disabled font-mono">
                          {conflict.id}
                        </span>
                        <span className="ml-auto rounded-pill border border-edge-strong px-2 py-0.5 text-[11px] font-medium text-ink-secondary capitalize">
                          {conflict.resolution_status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-ink-primary">
                        {conflict.description}
                      </p>
                    </div>

                    {/* Side-by-Side comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      {/* Source A */}
                      <div className="border border-edge-subtle bg-surface-elevated rounded-input p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary truncate">
                            {conflict.source_a.label}
                          </span>
                          <button
                            onClick={() => inspectEvidence(conflict.source_a.artifact_id, conflict.source_a.span)}
                            className="text-[11px] font-medium text-ink-primary underline hover:text-ink-secondary"
                          >
                            Inspect
                          </button>
                        </div>
                        <p className="text-xs font-mono text-ink-secondary leading-relaxed bg-white/70 p-2 rounded border border-edge-subtle">
                          "{conflict.source_a.span}"
                        </p>
                      </div>

                      {/* Source B */}
                      <div className="border border-edge-subtle bg-surface-elevated rounded-input p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary truncate">
                            {conflict.source_b.label}
                          </span>
                          <button
                            onClick={() => inspectEvidence(conflict.source_b.artifact_id, conflict.source_b.span)}
                            className="text-[11px] font-medium text-ink-primary underline hover:text-ink-secondary"
                          >
                            Inspect
                          </button>
                        </div>
                        <p className="text-xs font-mono text-ink-secondary leading-relaxed bg-white/70 p-2 rounded border border-edge-subtle">
                          "{conflict.source_b.span}"
                        </p>
                      </div>
                    </div>

                    {conflict.resolution_note && (
                      <div className="border-t border-edge-subtle pt-3">
                        <p className="text-xs text-ink-tertiary">
                          <span className="font-semibold text-ink-secondary">Resolution Analysis: </span>
                          {conflict.resolution_note}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Missing Evidence */}
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-edge-default">
                <div>
                  <h2 className="text-lg font-semibold text-ink-primary">
                    Critical Information Gaps
                  </h2>
                  <p className="text-xs text-ink-tertiary">
                    Facts expected from commits, architecture syncs, or runbooks that could not be verified in any connected source.
                  </p>
                </div>
                <span className="rounded-pill bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
                  {data.missing_evidence.length}
                </span>
              </div>

              <div className="space-y-3">
                {data.missing_evidence.map((gap, idx) => (
                  <div
                    key={idx}
                    className="bg-surface-card border border-edge-default rounded-card p-4 shadow-card flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-ink-primary">
                          {gap.key}
                        </span>
                        <span className="rounded-pill bg-surface-elevated border border-edge-strong px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">
                          Missing Artifact
                        </span>
                      </div>
                      <p className="text-xs text-ink-secondary leading-relaxed">
                        {gap.description}
                      </p>
                    </div>

                    <div className="sm:max-w-xs shrink-0 bg-surface-elevated p-3 rounded-input border border-edge-subtle">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary block mb-1">
                        Recommended Action
                      </span>
                      <p className="text-xs text-ink-primary leading-snug">
                        {gap.suggested_action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Unanswered Interview Questions */}
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-edge-default">
                <div>
                  <h2 className="text-lg font-semibold text-ink-primary">
                    Unanswered Questions
                  </h2>
                  <p className="text-xs text-ink-tertiary">
                    Questions dispatched to the leaver that have not yet received a response.
                  </p>
                </div>
                <span className="rounded-pill bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
                  {data.unanswered_questions.length}
                </span>
              </div>

              <div className="space-y-2">
                {data.unanswered_questions.map((q) => (
                  <div
                    key={q.question_id}
                    className="bg-surface-card border border-edge-default rounded-card p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-ink-disabled shrink-0">
                        {q.question_id}
                      </span>
                      <p className="text-xs text-ink-primary">
                        {q.text}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-pill border border-edge-strong px-2.5 py-0.5 text-[11px] font-medium text-ink-secondary uppercase">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
