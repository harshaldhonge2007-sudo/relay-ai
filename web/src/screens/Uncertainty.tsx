import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { UncertaintyData } from "../types";
import { useEvidenceDrawer } from "../components/EvidenceDrawer";
import PageContainer from "../components/ui/PageContainer";
import PageHeader from "../components/ui/PageHeader";
import NextStepFooter from "../components/ui/NextStepFooter";

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
    <PageContainer width="standard">
      <PageHeader
        stepNumber={3}
        stepEyebrow="Interview & Fill"
        title="Uncertainty & Gaps"
        description="Explicit boundaries of extracted knowledge. Missing evidence, contradictions, and unanswered questions are displayed transparently instead of guessed."
        metaChips={
          data
            ? [
                { label: "Contradictions", value: data.conflicts.length },
                { label: "Missing Evidence", value: data.missing_evidence.length },
                { label: "Pending Questions", value: data.unanswered_questions.length },
              ]
            : undefined
        }
      />

      {loading && (
        <div className="space-y-6 animate-pulse">
          <div className="h-28 bg-surface-card border border-edge-default rounded-card" />
          <div className="h-44 bg-surface-card border border-edge-default rounded-card" />
        </div>
      )}

      {error && (
        <div className="bg-surface-card border border-edge-strong rounded-card p-6 text-center">
          <p className="text-sm text-ink-primary font-semibold mb-1">Error</p>
          <p className="text-xs text-ink-secondary mb-4">{error}</p>
          <button
            onClick={loadData}
            className="bg-ink-primary text-white text-xs font-medium px-4 py-2 rounded-btn"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && data && (
        <div className="space-y-8 mb-8">
          {/* Section 1: Conflicts & Contradictions */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-edge-default">
              <div>
                <h2 className="text-base font-semibold text-ink-primary">
                  Cross-Source Contradictions
                </h2>
                <p className="text-xs text-ink-secondary">
                  When two primary sources disagree, both are preserved side-by-side with provenance.
                </p>
              </div>
              <span className="rounded-pill bg-surface-elevated border border-edge-strong px-2.5 py-0.5 text-xs font-mono font-medium text-ink-primary">
                {data.conflicts.length}
              </span>
            </div>

            <div className="space-y-4">
              {data.conflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className="bg-surface-card border border-edge-default rounded-card p-5 space-y-4 transition-shadow hover:shadow-card"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-ink-primary">
                        Contradiction
                      </span>
                      <span className="text-[11px] text-ink-tertiary font-mono">
                        {conflict.id}
                      </span>
                      <span className="ml-auto rounded-pill border border-edge-strong px-2 py-0.5 text-[10px] font-mono text-ink-secondary capitalize">
                        {conflict.resolution_status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-ink-primary">
                      {conflict.description}
                    </p>
                  </div>

                  {/* Side-by-Side comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* Source A */}
                    <div className="border border-edge-default bg-surface-base rounded-input p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-ink-secondary truncate">
                          {conflict.source_a.label}
                        </span>
                        <button
                          onClick={() => inspectEvidence(conflict.source_a.artifact_id, conflict.source_a.span)}
                          className="text-[11px] font-mono font-semibold text-ink-primary underline hover:text-ink-secondary"
                        >
                          Inspect →
                        </button>
                      </div>
                      <p className="text-xs font-mono text-ink-primary leading-relaxed bg-surface-card p-2.5 rounded border border-edge-default">
                        "{conflict.source_a.span}"
                      </p>
                    </div>

                    {/* Source B */}
                    <div className="border border-edge-default bg-surface-base rounded-input p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-ink-secondary truncate">
                          {conflict.source_b.label}
                        </span>
                        <button
                          onClick={() => inspectEvidence(conflict.source_b.artifact_id, conflict.source_b.span)}
                          className="text-[11px] font-mono font-semibold text-ink-primary underline hover:text-ink-secondary"
                        >
                          Inspect →
                        </button>
                      </div>
                      <p className="text-xs font-mono text-ink-primary leading-relaxed bg-surface-card p-2.5 rounded border border-edge-default">
                        "{conflict.source_b.span}"
                      </p>
                    </div>
                  </div>

                  {conflict.resolution_note && (
                    <div className="border-t border-edge-default pt-3">
                      <p className="text-xs text-ink-secondary leading-relaxed">
                        <span className="font-semibold text-ink-primary">Resolution Analysis: </span>
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
                <h2 className="text-base font-semibold text-ink-primary">
                  Critical Information Gaps
                </h2>
                <p className="text-xs text-ink-secondary">
                  Facts expected from commits, architecture syncs, or runbooks that could not be verified in any connected source.
                </p>
              </div>
              <span className="rounded-pill bg-surface-elevated border border-edge-strong px-2.5 py-0.5 text-xs font-mono font-medium text-ink-primary">
                {data.missing_evidence.length}
              </span>
            </div>

            <div className="space-y-3">
              {data.missing_evidence.map((gap, idx) => (
                <div
                  key={idx}
                  className="bg-surface-card border border-edge-default rounded-card p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-shadow hover:shadow-card"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-ink-primary">
                        {gap.key}
                      </span>
                      <span className="rounded-pill bg-surface-elevated border border-edge-strong px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-ink-secondary">
                        Missing Artifact
                      </span>
                    </div>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      {gap.description}
                    </p>
                  </div>

                  <div className="sm:max-w-xs shrink-0 bg-surface-base p-3 rounded-input border border-edge-default">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary block mb-1">
                      Recommended Action
                    </span>
                    <p className="text-xs text-ink-primary leading-snug font-medium">
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
                <h2 className="text-base font-semibold text-ink-primary">
                  Unanswered Questions
                </h2>
                <p className="text-xs text-ink-secondary">
                  Questions dispatched to the leaver that have not yet received a response.
                </p>
              </div>
              <span className="rounded-pill bg-surface-elevated border border-edge-strong px-2.5 py-0.5 text-xs font-mono font-medium text-ink-primary">
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
                    <span className="font-mono text-xs text-ink-tertiary shrink-0">
                      {q.question_id}
                    </span>
                    <p className="text-xs text-ink-primary font-medium">
                      {q.text}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-pill border border-edge-strong px-2.5 py-0.5 text-[10px] font-mono text-ink-secondary uppercase">
                    Pending Response
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <NextStepFooter
        nextLabel="Generate & Answer Leaver Interview Questions"
        nextUrl={`/cases/${caseId || "shopledger-priya"}/interview`}
        currentStep={3}
        totalSteps={5}
      />
    </PageContainer>
  );
}
