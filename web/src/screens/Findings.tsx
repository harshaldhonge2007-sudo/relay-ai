import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";
import { useEvidenceDrawer } from "../components/EvidenceDrawer";
import { useRole } from "../contexts/CaseContext";
import { Finding } from "../types";
import PageContainer from "../components/ui/PageContainer";
import PageHeader from "../components/ui/PageHeader";
import NextStepFooter from "../components/ui/NextStepFooter";
import Severity from "../components/ui/Severity";

type KindFilter = "all" | "contradiction" | "inflight" | "hidden_dependency" | "undocumented_decision";

const KIND_LABELS: Record<KindFilter, string> = {
  all: "All",
  contradiction: "Contradiction",
  inflight: "In-Flight",
  hidden_dependency: "Hidden Dep.",
  undocumented_decision: "Undocumented",
};

const KIND_DISPLAY: Record<string, string> = {
  contradiction: "Contradiction",
  inflight: "In-Flight Work",
  hidden_dependency: "Hidden Dependency",
  undocumented_decision: "Undocumented Decision",
};

const FILTER_KEYS: KindFilter[] = [
  "all",
  "contradiction",
  "inflight",
  "hidden_dependency",
  "undocumented_decision",
];

function getSeverityLevel(severity: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (severity >= 0.8) return "CRITICAL";
  if (severity >= 0.6) return "HIGH";
  if (severity >= 0.4) return "MEDIUM";
  return "LOW";
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function FindingCard({
  finding,
  index,
  onInspectEvidence,
}: {
  finding: Finding;
  index: number;
  onInspectEvidence: (artifactId: string, span?: string) => void;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const isContradiction = finding.kind === "contradiction";

  return (
    <div
      className="bg-surface-card border border-edge-default rounded-card p-5 transition-shadow hover:shadow-card animate-fadeIn"
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: "both" }}
    >
      {/* Top row: kind label + status + severity */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-ink-secondary">
            {KIND_DISPLAY[finding.kind] || finding.kind}
          </span>
          <span className="inline-flex items-center rounded-pill border border-edge-strong px-2 py-0.5 text-[10px] font-mono uppercase text-ink-primary">
            {finding.status}
          </span>
        </div>
        <Severity
          level={getSeverityLevel(finding.severity)}
          score={Math.round(finding.severity * 100)}
          size="sm"
          showIcon={true}
        />
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-ink-primary leading-snug">
        {finding.title}
      </h3>

      {/* Summary */}
      <p className="mt-2 text-xs text-ink-secondary leading-relaxed">
        {finding.summary}
      </p>

      {/* Contradiction Side-by-Side if applicable */}
      {isContradiction && finding.evidence.length >= 2 && (
        <div className="mt-4 p-3 bg-surface-base border border-edge-default rounded-input space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-ink-secondary border-b border-edge-default pb-1">
            <span>Source A</span>
            <span className="font-semibold text-ink-primary">VS Conflict</span>
            <span>Source B</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div className="border-l-2 border-edge-strong pl-2.5">
              <span className="text-[10px] font-mono text-ink-secondary block">
                {finding.evidence[0].artifact_id} {finding.evidence[0].role && `(${finding.evidence[0].role})`}
              </span>
              <p className="text-xs text-ink-primary italic mt-0.5">
                "{finding.evidence[0].span || "Cited state"}"
              </p>
            </div>
            <div className="border-l-2 border-edge-default pl-2.5">
              <span className="text-[10px] font-mono text-ink-secondary block">
                {finding.evidence[1].artifact_id} {finding.evidence[1].role && `(${finding.evidence[1].role})`}
              </span>
              <p className="text-xs text-ink-primary italic mt-0.5">
                "{finding.evidence[1].span || "Conflicting state"}"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Severity bar */}
      <div className="mt-4">
        <div className="h-1.5 w-full rounded-pill bg-edge-default overflow-hidden">
          <div
            className={`h-full rounded-pill ${
              finding.severity >= 0.7 ? "hatch-critical bg-edge-dark" : "bg-ink-primary"
            }`}
            style={{ width: pct(finding.severity) }}
          />
        </div>
      </div>

      {/* Severity / Confidence / Evidence Toggle */}
      <div className="mt-2.5 flex items-center justify-between text-xs text-ink-secondary">
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span>
            Severity: <strong className="text-ink-primary">{pct(finding.severity)}</strong>
          </span>
          <span>
            Confidence: <strong className="text-ink-primary">{pct(finding.confidence)}</strong>
          </span>
        </div>

        {finding.evidence.length > 0 && (
          <button
            type="button"
            onClick={() => setShowEvidence((e) => !e)}
            className="text-xs font-semibold text-ink-primary underline hover:text-ink-secondary focus:outline-none"
          >
            {showEvidence ? "Hide Evidence" : `Evidence (${finding.evidence.length})`}
          </button>
        )}
      </div>

      {/* Evidence list */}
      {showEvidence && finding.evidence.length > 0 && (
        <div className="mt-4 pt-3 border-t border-edge-default space-y-2 animate-fadeIn">
          {finding.evidence.map((e, idx) => (
            <div
              key={idx}
              className="rounded-input bg-surface-elevated p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-edge-default"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-ink-secondary font-semibold">
                    {e.artifact_id}
                  </span>
                  {e.role && (
                    <span className="uppercase text-[10px] tracking-wider text-ink-secondary font-semibold">
                      · {e.role}
                    </span>
                  )}
                  {e.withheld && (
                    <span className="rounded-pill border border-edge-strong px-2 py-0.2 text-[10px] font-mono text-ink-secondary">
                      Access Restricted
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-primary font-mono italic">
                  "{e.span || "Evidence cited"}"
                </p>
              </div>

              {!e.withheld ? (
                <button
                  type="button"
                  onClick={() => onInspectEvidence(e.artifact_id, e.span)}
                  className="text-xs font-semibold text-ink-primary underline hover:text-ink-secondary shrink-0 self-end sm:self-auto"
                >
                  View Source →
                </button>
              ) : (
                <span className="text-[11px] text-ink-secondary shrink-0 italic">
                  Withheld
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Findings() {
  const { caseId } = useParams<{ caseId: string }>();
  const { role } = useRole();
  const { openDrawer } = useEvidenceDrawer();

  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<KindFilter>("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/cases/${caseId}/findings`);
        if (!res.ok) throw new Error(`Failed to load findings (${res.status})`);
        const data: Finding[] = await res.json();
        if (!cancelled) setFindings(data);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [caseId, role]);

  const handleInspect = async (artifactId: string, span?: string) => {
    try {
      const res = await apiFetch(`/artifacts/${artifactId}`);
      if (res.ok) {
        const art = await res.json();
        openDrawer([{ ...art, highlight: span }], art.title);
      } else {
        openDrawer([{ artifact_id: artifactId, withheld: true }], artifactId);
      }
    } catch {
      openDrawer([{ artifact_id: artifactId, withheld: true }], artifactId);
    }
  };

  const counts = useMemo(() => {
    const c: Record<KindFilter, number> = {
      all: findings.length,
      contradiction: 0,
      inflight: 0,
      hidden_dependency: 0,
      undocumented_decision: 0,
    };
    for (const f of findings) {
      if (f.kind in c) {
        c[f.kind as KindFilter] = (c[f.kind as KindFilter] || 0) + 1;
      }
    }
    return c;
  }, [findings]);

  const visible = useMemo(() => {
    const filtered =
      activeFilter === "all"
        ? findings
        : findings.filter((f) => f.kind === activeFilter);
    return [...filtered].sort((a, b) => b.severity - a.severity);
  }, [findings, activeFilter]);

  return (
    <PageContainer width="standard">
      <PageHeader
        stepNumber={2}
        stepEyebrow="Reconstruct"
        title="Findings & Contradictions"
        description="Deterministic gap and contradiction detection linking code, pull requests, issues, chat, and documentation."
        metaChips={[
          { label: "Total Findings", value: findings.length },
          { label: "Contradictions", value: counts.contradiction },
          { label: "In-Flight", value: counts.inflight },
        ]}
      />

      {/* Filter pills */}
      {!loading && !error && (
        <div className="flex flex-wrap gap-2 mb-6 animate-fadeIn">
          {FILTER_KEYS.map((key) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={`rounded-pill px-3.5 py-1 text-xs font-mono transition-all duration-200 focus:outline-none ${
                  isActive
                    ? "bg-ink-primary text-white shadow-sm font-semibold"
                    : "border border-edge-strong text-ink-secondary hover:text-ink-primary hover:border-edge-dark"
                }`}
              >
                {KIND_LABELS[key]}
                <span className={`ml-1.5 text-[10px] ${isActive ? "text-edge-default" : "text-ink-tertiary"}`}>
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-28 bg-surface-card border border-edge-default rounded-card" />
          <div className="h-28 bg-surface-card border border-edge-default rounded-card" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-card border border-edge-strong bg-surface-card p-6 text-center">
          <p className="text-xs text-ink-secondary mb-3">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-btn bg-ink-primary px-4 py-1.5 text-xs font-medium text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && visible.length === 0 && (
        <div className="rounded-card border border-edge-default bg-surface-card p-12 text-center">
          <p className="text-xs text-ink-secondary">
            No findings found for this category.
          </p>
        </div>
      )}

      {/* Findings List */}
      {!loading && !error && visible.length > 0 && (
        <div className="space-y-4 mb-8">
          {visible.map((f, idx) => (
            <FindingCard
              key={f.id}
              finding={f}
              index={idx}
              onInspectEvidence={handleInspect}
            />
          ))}
        </div>
      )}

      <NextStepFooter
        nextLabel="Resolve Ambiguities & Uncertainty"
        nextUrl={`/cases/${caseId || "shopledger-priya"}/uncertainty`}
        currentStep={2}
        totalSteps={5}
      />
    </PageContainer>
  );
}
